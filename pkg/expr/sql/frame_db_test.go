package sql

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestFrameDB(t *testing.T) {
	frameA := &data.Frame{
		RefID: "a",
		Fields: []*data.Field{
			data.NewField("animal", nil, []string{"cat", "dog", "cat", "dog"}),
			data.NewField("nanimal", nil, []*string{p("cat"), nil, p("cat"), p("dog")}),
			data.NewField("fcount", nil, []float64{1, 3, 4, 7}),
			data.NewField("nfcount", nil, []*float64{p(2.0), nil, p(8.0), p(14.0)}),
			data.NewField("nfcountnn", nil, []*float64{p(2.0), p(4.0), p(8.0), p(14.0)}),
			data.NewField("i64count", nil, []int64{1, 3, 4, 7}),
			data.NewField("ni64count", nil, []*int64{p(int64(2)), nil, p(int64(8)), p(int64(14))}),
			data.NewField("bool", nil, []bool{true, false, true, false}),
			data.NewField("nbool", nil, []*bool{p(true), nil, p(true), p(false)}),
		},
	}

	db := DB{}
	qry := `SELECT * from A`
	// qry := "SELECT load_file('/etc/passwd')"
	// qry := "SELECT sloth()"
	// qry := "SELECT 2.35, -128, -32768, -8388608, -2147483648, 255, 65535, 16777215, 4294967295"
	// qry := "SELECT animal, sum(fcount), sum(nfcount), sum(nfcountnn) FROM a GROUP BY animal"

	f := data.NewFrame("")

	err := db.QueryFramesInto("a", qry, []*data.Frame{frameA}, f)
	if err != nil {
		t.Log(err)
		t.FailNow()
	}

	t.Log(f.StringTable(-1, -1))
}

func p[T any](v T) *T {
	return &v
}
