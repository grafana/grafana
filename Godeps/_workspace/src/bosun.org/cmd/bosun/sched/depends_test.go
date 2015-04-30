package sched

import (
	"testing"
	"time"

	"bosun.org/cmd/bosun/expr"
	"bosun.org/opentsdb"
)

// Crit returns {a=b},{a=c}, but {a=b} is ignored by dependency expression.
// Result should be {a=c} only.
func TestDependency_Simple(t *testing.T) {
	testSched(t, &schedTest{
		conf: `alert a {
			crit = avg(q("avg:c{a=*}", "5m", "")) > 0
			depends = avg(q("avg:d{a=*}", "5m", "")) > 0
		}`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:c{a=*}", ` + window5Min + `)`: {
				{
					Metric: "c",
					Tags:   opentsdb.TagSet{"a": "b"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
				{
					Metric: "c",
					Tags:   opentsdb.TagSet{"a": "c"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
			},
			`q("avg:d{a=*}", ` + window5Min + `)`: {
				{
					Metric: "d",
					Tags:   opentsdb.TagSet{"a": "b"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
				{
					Metric: "d",
					Tags:   opentsdb.TagSet{"a": "c"},
					DPS:    map[string]opentsdb.Point{"0": 0},
				},
			},
		},
		state: map[schedState]bool{
			schedState{"a{a=c}", "critical"}: true,
		},
	})
}

// Crit and depends don't have same tag sets.
func TestDependency_Overlap(t *testing.T) {
	testSched(t, &schedTest{
		conf: `alert a {
			crit = avg(q("avg:c{a=*,b=*}", "5m", "")) > 0
			depends = avg(q("avg:d{a=*,d=*}", "5m", "")) > 0
		}`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:c{a=*,b=*}", ` + window5Min + `)`: {
				{
					Metric: "c",
					Tags:   opentsdb.TagSet{"a": "b", "b": "r"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
				{
					Metric: "c",
					Tags:   opentsdb.TagSet{"a": "b", "b": "z"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
				{
					Metric: "c",
					Tags:   opentsdb.TagSet{"a": "c", "b": "q"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
			},
			`q("avg:d{a=*,d=*}", ` + window5Min + `)`: {
				{
					Metric: "d",
					Tags:   opentsdb.TagSet{"a": "b", "d": "q"}, //this matches first and second datapoints from crit.
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
			},
		},
		state: map[schedState]bool{
			schedState{"a{a=c,b=q}", "critical"}: true,
		},
	})
}

func TestDependency_OtherAlert(t *testing.T) {
	testSched(t, &schedTest{
		conf: `alert a {
			crit = avg(q("avg:a{host=*,cpu=*}", "5m", "")) > 0
		}
		alert b{
			depends = alert("a","crit")
			crit = avg(q("avg:b{host=*}", "5m", "")) > 0
		}
		alert c{
			crit = avg(q("avg:b{host=*}", "5m", "")) > 0
		}
		alert d{
			#b will be unevaluated because of a.
			depends = alert("b","crit")
			crit = avg(q("avg:b{host=*}", "5m", "")) > 0
		}
		`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:a{cpu=*,host=*}", ` + window5Min + `)`: {
				{
					Metric: "a",
					Tags:   opentsdb.TagSet{"host": "ny01", "cpu": "0"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
			},
			`q("avg:b{host=*}", ` + window5Min + `)`: {
				{
					Metric: "b",
					Tags:   opentsdb.TagSet{"host": "ny01"},
					DPS:    map[string]opentsdb.Point{"0": 1},
				},
			},
		},
		state: map[schedState]bool{
			schedState{"a{cpu=0,host=ny01}", "critical"}: true,
			schedState{"c{host=ny01}", "critical"}:       true,
		},
	})
}

func TestDependency_OtherAlert_Unknown(t *testing.T) {
	state := NewStatus("a{host=ny02}")
	state.Touched = queryTime.Add(-10 * time.Minute)
	state.Append(&Event{Status: StNormal, Time: state.Touched})

	testSched(t, &schedTest{
		conf: `alert a {
			warn = avg(q("avg:a{host=*}", "5m", "")) > 0
		}

	alert os.cpu {
    	depends = alert("a", "warn")
    	warn = avg(q("avg:os.cpu{host=*}", "5m", "")) > 5
	}
		`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:a{host=*}", ` + window5Min + `)`: {
				{
					Metric: "a",
					Tags:   opentsdb.TagSet{"host": "ny01"},
					DPS:    map[string]opentsdb.Point{"0": 0},
				},
				//no results for ny02. Goes unkown here.
			},
			`q("avg:os.cpu{host=*}", ` + window5Min + `)`: {
				{
					Metric: "os.cpu",
					Tags:   opentsdb.TagSet{"host": "ny01"},
					DPS:    map[string]opentsdb.Point{"0": 10},
				},
				{
					Metric: "os.cpu",
					Tags:   opentsdb.TagSet{"host": "ny02"},
					DPS:    map[string]opentsdb.Point{"0": 10},
				},
			},
		},
		state: map[schedState]bool{
			schedState{"a{host=ny02}", "unknown"}:      true,
			schedState{"os.cpu{host=ny01}", "warning"}: true,
		},
		previous: map[expr.AlertKey]*State{
			"a{host=ny02}": state,
		},
	})
}

func TestDependency_OtherAlert_UnknownChain(t *testing.T) {
	ab := expr.AlertKey("a{host=b}")
	bb := expr.AlertKey("b{host=b}")
	cb := expr.AlertKey("c{host=b}")
	as := NewStatus(ab)
	as.Touched = queryTime.Add(-time.Hour)
	as.Append(&Event{Status: StNormal})
	bs := NewStatus(ab)
	bs.Touched = queryTime
	bs.Append(&Event{Status: StNormal})
	cs := NewStatus(ab)
	cs.Touched = queryTime
	cs.Append(&Event{Status: StNormal})
	s := testSched(t, &schedTest{
		conf: `
		alert a {
			warn = avg(q("avg:a{host=*}", "5m", "")) && 0
		}

		alert b {
			depends = alert("a", "warn")
			warn = avg(q("avg:b{host=*}", "5m", "")) > 0 
		}

		alert c {
			depends = alert("b", "warn")
			warn = avg(q("avg:b{host=*}", "5m", "")) > 0
		}
		`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:a{host=*}", ` + window5Min + `)`: {},
			`q("avg:b{host=*}", ` + window5Min + `)`: {{
				Metric: "b",
				Tags:   opentsdb.TagSet{"host": "b"},
				DPS:    map[string]opentsdb.Point{"0": 0},
			}},
		},
		state: map[schedState]bool{
			schedState{string(ab), "unknown"}: true,
		},
		previous: map[expr.AlertKey]*State{
			ab: as,
			bb: bs,
			cb: cs,
		},
	})
	if s.status[ab].Unevaluated {
		t.Errorf("should not be unevaluated: %s", ab)
	}
	if !s.status[bb].Unevaluated {
		t.Errorf("should be unevaluated: %s", bb)
	}
	if !s.status[cb].Unevaluated {
		t.Errorf("should be unevaluated: %s", cb)
	}
}

func TestDependency_Blocks_Unknown(t *testing.T) {
	state := NewStatus("a{host=ny01}")
	state.Touched = queryTime.Add(-10 * time.Minute)
	state.Append(&Event{Status: StNormal, Time: state.Touched})

	testSched(t, &schedTest{
		conf: `alert a {
			depends = avg(q("avg:b{host=*}", "5m", "")) > 0
			warn = avg(q("avg:a{host=*}", "5m", "")) > 0
		}`,
		queries: map[string]opentsdb.ResponseSet{
			`q("avg:a{host=*}", ` + window5Min + `)`: {
			//no results for a. Goes unkown here.
			},
			`q("avg:b{host=*}", ` + window5Min + `)`: {
				{
					Metric: "os.cpu",
					Tags:   opentsdb.TagSet{"host": "ny01"},
					DPS:    map[string]opentsdb.Point{"0": 10},
				},
			},
		},
		state: map[schedState]bool{},
		previous: map[expr.AlertKey]*State{
			"a{host=ny01}": state,
		},
	})
}

func TestDependency_AlertFunctionHasNoResults(t *testing.T) {
	pingState := NewStatus("ping.host{host=ny01,source=bosun01}")
	pingState.Touched = queryTime.Add(-5 * time.Minute)
	pingState.Append(&Event{Status: StNormal, Time: pingState.Touched})

	scollState := NewStatus("scollector.down{host=ny01}")
	scollState.Touched = queryTime.Add(-10 * time.Minute)
	scollState.Append(&Event{Status: StNormal, Time: scollState.Touched})

	cpuState := NewStatus("os.cpu{host=ny01}")
	cpuState.Touched = queryTime.Add(-10 * time.Minute)
	cpuState.Append(&Event{Status: StWarning, Time: cpuState.Touched})

	testSched(t, &schedTest{
		conf: `
alert ping.host {
    warn = max(rename(q("sum:bosun.ping.timeout{dst_host=*,host=*}", "5m", ""), "host=source,dst_host=host"))
}

alert scollector.down {
	depends = alert("ping.host", "warn")
	warn = avg(q("avg:os.cpu{host=*}", "5m", "")) < -100
}

alert os.cpu {
    depends = alert("scollector.down", "warn")
    warn = avg(q("avg:rate{counter,,1}:os.cpu{host=*}", "5m", ""))
}
`,
		queries: map[string]opentsdb.ResponseSet{
			`q("sum:bosun.ping.timeout{dst_host=*,host=*}", ` + window5Min + `)`: {
				{
					Metric: "bosun.ping.timeout",
					Tags:   opentsdb.TagSet{"host": "bosun01", "dst_host": "ny01"},
					DPS:    map[string]opentsdb.Point{"0": 1}, //ping fails
				},
			},
			`q("avg:os.cpu{host=*}", ` + window5Min + `)`:                  {}, //no other data
			`q("avg:rate{counter,,1}:os.cpu{host=*}", ` + window5Min + `)`: {},
		},
		state: map[schedState]bool{
			schedState{"ping.host{host=ny01,source=bosun01}", "warning"}: true,
		},
		previous: map[expr.AlertKey]*State{
			"ping.host{host=ny01,source=bosun01}": pingState,
			"scollector.down{host=ny01}":          scollState,
			"os.cpu{host=ny01}":                   cpuState,
		},
	})
}
