package sql

import (
	"context"
	"testing"

	sqle "github.com/dolthub/go-mysql-server"
	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestFrameDB(t *testing.T) {
	frameA := &data.Frame{
		RefID: "a",
		Fields: []*data.Field{
			data.NewField("animal", nil, []string{"cat", "dog", "cat", "dog"}),
			data.NewField("nanimal", nil, []*string{p("cat"), p("dog"), p("cat"), p("dog")}),
			data.NewField("count", nil, []float64{1, 3, 4, 7}),
			data.NewField("ncount", nil, []*float64{p(2.0), p(6.0), p(8.0), p(14.0)}),
		},
	}

	provider := NewFramesDBProvider([]*data.Frame{frameA})

	session := mysql.NewBaseSession()
	ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))
	ctx.SetCurrentDatabase("frames")

	engine := sqle.NewDefault(provider)

	schema, iter, _, err := engine.Query(ctx, "SELECT * from a")
	//schema, iter, _, err := engine.Query(ctx, "SELECT animal, sum(Count), sum(fCount) FROM a GROUP BY animal")

	if err != nil {
		t.Log(err)
		t.FailNow()
	}
	if iter == nil {
		t.Log("no iter, is nil")
		t.FailNow()
	}
	f := data.NewFrame("")
	err = convertToDataFrame(ctx, iter, schema, f)
	if err != nil {
		t.Log(err)
		t.FailNow()
	}
	t.Log(f.StringTable(-1, -1))
}

func p[T any](v T) *T {
	return &v
}
