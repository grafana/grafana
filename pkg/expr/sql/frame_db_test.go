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
			data.NewField("fcount", nil, []float64{1, 3, 4, 7}),
			data.NewField("nfcount", nil, []*float64{p(2.0), nil, p(8.0), p(14.0)}),
			data.NewField("i64count", nil, []int64{1, 3, 4, 7}),
			data.NewField("ni64count", nil, []*int64{p(int64(2)), nil, p(int64(8)), p(int64(14))}),
			data.NewField("bool", nil, []bool{true, false, true, false}),
			data.NewField("nbool", nil, []*bool{p(true), p(false), p(true), p(false)}),
		},
	}

	provider := NewFramesDBProvider([]*data.Frame{frameA})

	session := mysql.NewBaseSession()
	ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))
	ctx.SetCurrentDatabase("frames")

	engine := sqle.NewDefault(provider)

	schema, iter, _, err := engine.Query(ctx, "SELECT * from a")
	//schema, iter, _, err := engine.Query(ctx, "SELECT SELECT 2.35, -128, -32768, -8388608, -2147483648, 255, 65535, 16777215, 4294967295")
	//schema, iter, _, err := engine.Query(ctx, "SELECT animal, sum(Count), sum(ncount) FROM a GROUP BY animal")

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
