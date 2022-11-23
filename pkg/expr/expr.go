package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// DatasourceType is the string constant used as the datasource when the property is in Datasource.Type.
// Type in requests is used to identify what type of data source plugin the request belongs to.
const DatasourceType = "__expr__"

// DatasourceUID is the string constant used as the datasource name in requests
// to identify it as an expression command when use in Datasource.UID.
const DatasourceUID = DatasourceType

// DatasourceID is the fake datasource id used in requests to identify it as an
// expression command.
const DatasourceID = -100

// OldDatasourceUID is the datasource uid used in requests to identify it as an
// expression command. It goes with the query root level datasourceUID property. It was accidentally
// set to the Id and is now kept for backwards compatibility. The newer Datasource.UID property
// should be used instead and should be set to "__expr__".
const OldDatasourceUID = "-100"

// IsDataSource checks if the uid points to an expression query
func IsDataSource(uid string) bool {
	return uid == DatasourceUID || uid == OldDatasourceUID
}

func DataSourceModel() *datasources.DataSource {
	return &datasources.DataSource{
		Id:             DatasourceID,
		Uid:            DatasourceUID,
		Name:           DatasourceUID,
		Type:           DatasourceType,
		JsonData:       simplejson.New(),
		SecureJsonData: make(map[string][]byte),
	}
}

// Request is similar to plugins.DataQuery but with the Time Ranges is per Query.
type Request struct {
	Headers map[string]string
	Debug   bool
	OrgId   int64
	Queries []Query
	User    *backend.User
}

// Query is like plugins.DataSubQuery, but with a a time range, and only the UID
// for the data source. Also interval is a time.Duration.
type Query struct {
	RefID         string
	TimeRange     TimeRange
	DataSource    *datasources.DataSource `json:"datasource"`
	JSON          json.RawMessage
	Interval      time.Duration
	QueryType     string
	MaxDataPoints int64
}

// TimeRange is a time.Time based TimeRange.
type TimeRange interface {
	AbsoluteTime(now time.Time) backend.TimeRange
}

type AbsoluteTimeRange struct {
	From time.Time
	To   time.Time
}

func (r AbsoluteTimeRange) AbsoluteTime(_ time.Time) backend.TimeRange {
	return backend.TimeRange{
		From: r.From,
		To:   r.To,
	}
}

// RelativeTimeRange is a time range relative to some absolute time.
type RelativeTimeRange struct {
	From time.Duration
	To   time.Duration
}

func (r RelativeTimeRange) AbsoluteTime(t time.Time) backend.TimeRange {
	return backend.TimeRange{
		From: t.Add(r.From),
		To:   t.Add(r.To),
	}
}

// Node is a node in a Data Pipeline. Node is either a expression command or a datasource query.
type Node interface {
	ID() int64 // ID() allows the gonum graph node interface to be fulfilled
	RefID() string
	String() string
}

// DataPipeline is an ordered set of nodes returned from DPGraph processing.
type DataPipeline interface {
	GetPipelineNodes() []Node
}

type QueryError struct {
	RefID string
	Err   error
}

func (e QueryError) Error() string {
	return fmt.Sprintf("failed to execute query %s: %s", e.RefID, e.Err)
}

func (e QueryError) Unwrap() error {
	return e.Err
}

// Service is service representation for expression handling.
type Service interface {
	// BuildPipeline builds a pipeline from a request.
	BuildPipeline(req *Request) (DataPipeline, error)

	// ExecutePipeline executes an expression pipeline and returns all the results.
	ExecutePipeline(ctx context.Context, now time.Time, pipeline DataPipeline) (*backend.QueryDataResponse, error)

	// TransformData takes Queries which are either expressions nodes
	// or are datasource requests.
	TransformData(ctx context.Context, now time.Time, req *Request) (r *backend.QueryDataResponse, err error)
}
