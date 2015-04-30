package expr

import (
	"testing"
	"time"
)

func TestExprSimple(t *testing.T) {
	var exprTests = []struct {
		input  string
		output Scalar
	}{
		{"!1", 0},
		{"-2", -2},
		{"1.444-010+2*3e2-4/5+0xff", 847.644},
		{"1>2", 0},
		{"3>2", 1},
		{"1==1", 1},
		{"1==2", 0},
		{"1!=01", 0},
		{"1!=2", 1},
		{"1<2", 1},
		{"2<1", 0},
		{"1||0", 1},
		{"0||0", 0},
		{"1&&0", 0},
		{"1&&2", 1},
		{"1<=0", 0},
		{"1<=1", 1},
		{"1<=2", 1},
		{"1>=0", 1},
		{"1>=1", 1},
		{"1>=2", 0},
		{"-1 > 0", 0},
		{"-1 < 0", 1},
	}

	for _, et := range exprTests {
		e, err := New(et.input)
		if err != nil {
			t.Error(err)
			break
		}
		r, _, err := e.Execute(nil, nil, nil, nil, nil, time.Now(), 0, false, nil, nil, nil)
		if err != nil {
			t.Error(err)
			break
		} else if len(r.Results) != 1 {
			t.Error("bad r len", len(r.Results))
			break
		} else if len(r.Results[0].Group) != 0 {
			t.Error("bad group len", r.Results[0].Group)
			break
		} else if r.Results[0].Value != et.output {
			t.Errorf("expected %v, got %v: %v\nast: %v", et.output, r.Results[0].Value, et.input, e)
		}
	}
}

func TestExprParse(t *testing.T) {
	var exprTests = []struct {
		input string
		valid bool
		tags  string
	}{
		{`avg(q("test", "1m", 1))`, false, ""},
		{`avg(q("avg:m", "1m", ""))`, true, ""},
		{`avg(q("avg:m{a=*}", "1m", ""))`, true, "a"},
		{`avg(q("avg:m{a=*,b=1}", "1m", ""))`, true, "a,b"},
		{`avg(q("avg:m{a=*,b=1}", "1m", "")) + 1`, true, "a,b"},
	}

	for _, et := range exprTests {
		e, err := New(et.input, TSDB)
		if et.valid && err != nil {
			t.Error(err)
		} else if !et.valid && err == nil {
			t.Errorf("expected invalid, but no error: %v", et.input)
		} else if et.valid {
			tags, err := e.Root.Tags()
			if err != nil {
				t.Error(err)
				continue
			}
			if et.tags != tags.String() {
				t.Errorf("%v: unexpected tags: got %v, expected %v", et.input, tags, et.tags)
			}
		}
	}
}

/*
const TSDBHost = "ny-devtsdb04:4242"

func TestExprQuery(t *testing.T) {
	e, err := New(`forecastlr(q("avg:os.cpu{host=ny-lb05}", "1m", ""), -10)`)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = e.Execute(opentsdb.Host(TSDBHost), nil)
	if err != nil {
		t.Fatal(err)
	}
}
*/
