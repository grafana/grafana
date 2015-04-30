package conf

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"bosun.org/opentsdb"
)

func TestPrint(t *testing.T) {
	fname := "test.conf"
	b, err := ioutil.ReadFile(fname)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Setenv("env", "1"); err != nil {
		t.Fatal(err)
	}
	c, err := New(fname, string(b))
	if err != nil {
		t.Fatal(err)
	}
	if w := c.Alerts["os.high_cpu"].Warn.Text; w != `avg(q("avg:rate:os.cpu{host=ny-nexpose01}", "2m", "")) > 80` {
		t.Error("bad warn:", w)
	}
	if w := c.Alerts["m"].Crit.Text; w != `avg(q("avg:a", "", "")) > 1` {
		t.Errorf("bad crit: %v", w)
	}
	if w := c.Alerts["braceTest"].Crit.Text; w != `avg(q("avg:o{t=m}", "", "")) > 1` {
		t.Errorf("bad crit: %v", w)
	}
	if w := c.Lookups["l"]; len(w.Entries) != 2 {
		t.Errorf("bad lookup: %v", w)
	}
	checkMacroVarAlert(t, c.Alerts["macroVarAlert"])
}

func checkMacroVarAlert(t *testing.T, a *Alert) {
	if a.Crit.String() != "3" {
		t.Errorf("expected 'crit = 3'")
	}
	nots := map[string]bool{
		"default": true,
		"nc1":     true,
		"nc2":     true,
		"nc3":     true,
		"nc4":     true,
	}
	for _, n := range a.CritNotification.Notifications {
		t.Log("found", n.Name)
		delete(nots, n.Name)
	}
	if len(nots) > 0 {
		t.Error("missing notifications", nots)
	}
	if a.Vars["a"] != "3" || a.Vars["$a"] != "3" {
		t.Errorf("missing vars: %v", a.Vars)
	}
}

func TestInvalid(t *testing.T) {
	names := map[string]string{
		"lookup-key-pairs":     "conf: lookup-key-pairs:3:1: at <entry a=3 { }>: lookup tags mismatch, expected {a=,b=}",
		"number-func-args":     `conf: number-func-args:4:1: at <warn = q("avg:o", ""...>: expr: parse: not enough arguments for q`,
		"lookup-key-pairs-dup": `conf: lookup-key-pairs-dup:3:1: at <entry b=2,a=1 { }>: duplicate entry`,
		"crit-warn-unmatching-tags": `conf: crit-warn-unmatching-tags:3:0: at <alert broken {\n	cri...>: crit tags (a,c) and warn tags (c) must be equal`,
		"depends-no-overlap": `conf: depends-no-overlap:3:0: at <alert broken {\n	dep...>: Depends and crit/warn must share at least one tag.`,
		"log-no-notification": `conf: log-no-notification:1:0: at <alert a {\n	crit = 1...>: log + crit specified, but no critNotification`,
		"crit-notification-no-template": `conf: crit-notification-no-template:5:0: at <alert a {\n	crit = 1...>: critNotification specified, but no template`,
	}
	for fname, reason := range names {
		path := filepath.Join("invalid", fname)
		b, err := ioutil.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		_, err = New(fname, string(b))
		if err == nil {
			t.Error("expected error in", path)
			continue
		}
		if err.Error() != reason {
			t.Errorf("got error `%s` in %s, expected `%s`", err, path, reason)
		}
	}
}

func TestSquelch(t *testing.T) {
	s := Squelches{
		[]Squelch{
			map[string]*regexp.Regexp{
				"x": regexp.MustCompile("ab"),
				"y": regexp.MustCompile("bc"),
			},
			map[string]*regexp.Regexp{
				"x": regexp.MustCompile("ab"),
				"z": regexp.MustCompile("de"),
			},
		},
	}
	type squelchTest struct {
		tags   opentsdb.TagSet
		expect bool
	}
	tests := []squelchTest{
		{
			opentsdb.TagSet{
				"x": "ab",
			},
			false,
		},
		{
			opentsdb.TagSet{
				"x": "abe",
				"y": "obcx",
			},
			true,
		},
		{
			opentsdb.TagSet{
				"x": "abe",
				"z": "obcx",
			},
			false,
		},
		{
			opentsdb.TagSet{
				"x": "abe",
				"z": "ouder",
			},
			true,
		},
		{
			opentsdb.TagSet{
				"x": "ae",
				"y": "bc",
				"z": "de",
			},
			false,
		},
	}
	for _, test := range tests {
		got := s.Squelched(test.tags)
		if got != test.expect {
			t.Errorf("for %v got %v, expected %v", test.tags, got, test.expect)
		}
	}
}
