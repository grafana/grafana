package opentsdb

import "testing"

func TestClean(t *testing.T) {
	clean := "aoeSNVT152-./_"
	if c, err := Clean(clean); c != clean {
		t.Error("was clean", clean)
	} else if err != nil {
		t.Fatal(err)
	}
	notclean := "euon@#$sar:.03   n  ]e/"
	notcleaned := "euonsar.03ne/"
	if c, err := Clean(notclean); c != notcleaned {
		t.Error("wasn't cleaned", notclean, "into:", c)
	} else if err != nil {
		t.Fatal(err)
	}
}

func TestParseQuery(t *testing.T) {
	tests := []struct {
		query string
		error bool
	}{
		{"sum:10m-avg:proc.stat.cpu{t=v,o=k}", false},
		{"sum:10m-avg:rate:proc.stat.cpu", false},
		{"sum:10m-avg:rate{counter,1,2}:proc.stat.cpu{t=v,o=k}", false},
		{"sum:proc.stat.cpu", false},
		{"sum:rate:proc.stat.cpu{t=v,o=k}", false},

		{"", true},
		{"sum:cpu+", true},
		{"sum:cpu{}", true},
		{"sum:stat{a=b=c}", true},
	}
	for _, q := range tests {
		_, err := ParseQuery(q.query)
		if err != nil && !q.error {
			t.Errorf("got error: %s: %s", q.query, err)
		} else if err == nil && q.error {
			t.Errorf("expected error: %s", q.query)
		}
	}
}

func TestParseRequest(t *testing.T) {
	tests := []struct {
		query string
		error bool
	}{
		{"start=1&m=sum:c", false},
		{"start=1&m=sum:c&end=2", false},
		{"start=1&m=sum:10m-avg:rate:proc.stat.cpu{t=v,o=k}", false},

		{"start=&m=", true},
		{"m=sum:c", true},
		{"start=1", true},
	}
	for _, q := range tests {
		_, err := ParseRequest(q.query)
		if err != nil && !q.error {
			t.Errorf("got error: %s: %s", q.query, err)
		} else if err == nil && q.error {
			t.Errorf("expected error: %s", q.query)
		}
	}
}

func TestQueryString(t *testing.T) {
	tests := []struct {
		in  Query
		out string
	}{
		{
			Query{
				Aggregator: "avg",
				Metric:     "test.metric",
				Rate:       true,
				RateOptions: RateOptions{
					Counter:    true,
					CounterMax: 1,
					ResetValue: 2,
				},
			},
			"avg:rate{counter,1,2}:test.metric",
		},
		{
			Query{
				Aggregator: "avg",
				Metric:     "test.metric",
				Rate:       true,
				RateOptions: RateOptions{
					Counter:    true,
					CounterMax: 1,
				},
			},
			"avg:rate{counter,1}:test.metric",
		},
		{
			Query{
				Aggregator: "avg",
				Metric:     "test.metric",
				Rate:       true,
				RateOptions: RateOptions{
					Counter: true,
				},
			},
			"avg:rate{counter}:test.metric",
		},
		{
			Query{
				Aggregator: "avg",
				Metric:     "test.metric",
				Rate:       true,
				RateOptions: RateOptions{
					CounterMax: 1,
					ResetValue: 2,
				},
			},
			"avg:rate:test.metric",
		},
		{
			Query{
				Aggregator: "avg",
				Metric:     "test.metric",
				RateOptions: RateOptions{
					Counter:    true,
					CounterMax: 1,
					ResetValue: 2,
				},
			},
			"avg:test.metric",
		},
	}
	for _, q := range tests {
		s := q.in.String()
		if s != q.out {
			t.Errorf(`got "%s", expected "%s"`, s, q.out)
		}
	}
}

func TestValidTag(t *testing.T) {
	tests := map[string]bool{
		"abcXYZ012_./-": true,

		"":    false,
		"a|c": false,
		"a=b": false,
	}
	for s, v := range tests {
		r := ValidTag(s)
		if v != r {
			t.Errorf("%v: got %v, expected %v", s, r, v)
		}
	}
}

func TestValidTags(t *testing.T) {
	tests := map[string]bool{
		"a=b|c,d=*": true,

		"":        false,
		"a=b,a=c": false,
		"a=b=c":   false,
	}
	for s, v := range tests {
		_, err := ParseTags(s)
		r := err == nil
		if v != r {
			t.Errorf("%v: got %v, expected %v", s, r, v)
		}
	}
}
