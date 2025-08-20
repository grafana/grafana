//go:build !arm

package sql

import (
	"context"
	"errors"
	"fmt"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	mysql "github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/go-mysql-server/sql/analyzer"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// DB is a database that can execute SQL queries against a set of Frames.
type DB struct{}

type QueryOption func(*QueryOptions)

type QueryOptions struct {
	Timeout        time.Duration
	MaxOutputCells int64
}

func WithTimeout(d time.Duration) QueryOption {
	return func(o *QueryOptions) {
		o.Timeout = d
	}
}

func WithMaxOutputCells(n int64) QueryOption {
	return func(o *QueryOptions) {
		o.MaxOutputCells = n
	}
}

// QueryFrames runs the sql query query against a database created from frames, and returns the frame.
// The RefID of each frame becomes a table in the database.
// It is expected that there is only one frame per RefID.
// The name becomes the name and RefID of the returned frame.
func (db *DB) QueryFrames(ctx context.Context, tracer tracing.Tracer, name string, query string, frames []*data.Frame, opts ...QueryOption) (*data.Frame, error) {
	// We are parsing twice due to TablesList, but don't care fow now. We can save the parsed query and reuse it later if we want.
	if allow, err := AllowQuery(name, query); err != nil || !allow {
		if err != nil {
			return nil, err
		}
		return nil, err
	}

	QueryOptions := &QueryOptions{}
	for _, opt := range opts {
		opt(QueryOptions)
	}

	if QueryOptions.Timeout != 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, QueryOptions.Timeout)
		defer cancel()
	}
	_, span := tracer.Start(ctx, "SSE.ExecuteGMSQuery")
	defer span.End()

	pro := NewFramesDBProvider(frames)
	session := mysql.NewBaseSession()

	// Create a new context with the session and tracer
	mCtx := mysql.NewContext(ctx, mysql.WithSession(session), mysql.WithTracer(tracer))

	// Select the database in the context
	mCtx.SetCurrentDatabase(dbName)

	// Empty dir does not disable secure_file_priv
	//ctx.SetSessionVariable(ctx, "secure_file_priv", "")

	// TODO: Check if it's wise to reuse the existing provider, rather than creating a new one
	a := analyzer.NewDefault(pro)

	engine := sqle.New(a, &sqle.Config{
		IsReadOnly: true,
	})

	contextErr := func(err error) error {
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			return MakeTimeOutError(err, name, QueryOptions.Timeout)
		case errors.Is(err, context.Canceled):
			return MakeCancelError(err, name)
		default:
			return fmt.Errorf("SQL expression for refId %v ended unexpectedly: %w", name, err)
		}
	}

	// Execute the query (planning + iterator construction)
	schema, iter, _, err := engine.Query(mCtx, query)
	if err != nil {
		if ctx.Err() != nil {
			return nil, contextErr(ctx.Err())
		}
		return nil, MakeGMSError(name, err)
	}

	// Convert the iterator into a Grafana data.Frame
	f, err := convertToDataFrame(mCtx, iter, schema, QueryOptions.MaxOutputCells)
	if err != nil {
		if ctx.Err() != nil {
			return nil, contextErr(ctx.Err())
		}
		return nil, err
	}

	f.Name = name
	f.RefID = name

	return f, nil
}
