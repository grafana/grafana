package sched

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"bosun.org/cmd/bosun/conf"
	"bosun.org/cmd/bosun/expr"
	"bosun.org/opentsdb"
)

func TestCheckFlapping(t *testing.T) {
	s := new(Schedule)
	c, err := conf.New("", `
		template t {
			subject = 1
		}
		notification n {
			print = true
		}
		alert a {
			warnNotification = n
			warn = 1
			critNotification = n
			crit = 1
			template = t
		}
	`)
	if err != nil {
		t.Fatal(err)
	}
	c.StateFile = ""
	s.Init(c)
	ak := expr.NewAlertKey("a", nil)
	r := &RunHistory{
		Events: map[expr.AlertKey]*Event{
			ak: {Status: StWarning},
		},
	}
	hasNots := func() bool {
		defer func() {
			s.notifications = nil
		}()
		if len(s.notifications) != 1 {
			return false
		}
		for k, v := range s.notifications {
			if k.Name != "n" || len(v) != 1 || v[0].Alert != "a" {
				return false
			}
			return true
		}
		return false
	}
	s.RunHistory(r)
	if !hasNots() {
		t.Fatalf("expected notification: %v", s.notifications)
	}
	r.Events[ak].Status = StNormal
	s.RunHistory(r)
	if hasNots() {
		t.Fatal("unexpected notification")
	}
	r.Events[ak].Status = StWarning
	s.RunHistory(r)
	if hasNots() {
		t.Fatal("unexpected notification")
	}
	r.Events[ak].Status = StNormal
	s.RunHistory(r)
	if hasNots() {
		t.Fatal("unexpected notification")
	}
	r.Events[ak].Status = StCritical
	s.RunHistory(r)
	if !hasNots() {
		t.Fatal("expected notification")
	}
	r.Events[ak].Status = StNormal
	s.RunHistory(r)
	if hasNots() {
		t.Fatal("unexpected notification")
	}
	s.RunHistory(r)
	// Close the alert, so it should notify next time.
	if err := s.Action("", "", ActionClose, ak); err != nil {
		t.Fatal(err)
	}
	r.Events[ak].Status = StWarning
	s.RunHistory(r)
	if !hasNots() {
		t.Fatal("expected notification")
	}
}

func TestCheckSilence(t *testing.T) {
	s := new(Schedule)
	done := make(chan bool, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		done <- true
	}))
	defer ts.Close()
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	c, err := conf.New("", fmt.Sprintf(`
		template t {
			subject = "test"
			body = "test"
		}
		notification n {
			post = http://%s/
		}
		alert a {
			template = t
			warnNotification = n
			warn = 1
		}
	`, u.Host))
	if err != nil {
		t.Fatal(err)
	}
	c.StateFile = ""
	err = s.Init(c)
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.AddSilence(time.Now().Add(-time.Hour), time.Now().Add(time.Hour), "a", "", false, true, "")
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Check(nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	s.CheckNotifications()
	select {
	case <-done:
		t.Fatal("silenced notification was sent")
	case <-time.After(time.Second * 2):
		// Timeout *probably* means the silence worked
	}
}

func TestCheckNotify(t *testing.T) {
	s := new(Schedule)
	nc := make(chan string)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := ioutil.ReadAll(r.Body)
		nc <- string(b)
	}))
	defer ts.Close()
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	c, err := conf.New("", fmt.Sprintf(`
		template t {
			subject = {{.Last.Status}}
		}
		notification n {
			post = http://%s/
		}
		alert a {
			template = t
			warnNotification = n
			warn = 1
		}
	`, u.Host))
	if err != nil {
		t.Fatal(err)
	}
	c.StateFile = ""
	err = s.Init(c)
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Check(nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	s.CheckNotifications()
	select {
	case r := <-nc:
		if r != "warning" {
			t.Fatalf("expected warning, got %v", r)
		}
	case <-time.After(time.Second):
		t.Fatal("failed to receive notification before timeout")
	}
}

func TestCheckNotifyUnknown(t *testing.T) {
	s := new(Schedule)
	nc := make(chan string, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := ioutil.ReadAll(r.Body)
		nc <- string(b)
	}))
	defer ts.Close()
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	c, err := conf.New("", fmt.Sprintf(`
		template t {
			subject = {{.Name}}: {{.Group | len}} unknown alerts
		}
		unknownTemplate = t
		notification n {
			post = http://%s/
		}
		alert a {
			template = t
			critNotification = n
			crit = 1
		}
	`, u.Host))
	if err != nil {
		t.Fatal(err)
	}
	c.StateFile = ""
	err = s.Init(c)
	if err != nil {
		t.Fatal(err)
	}
	r := &RunHistory{
		Events: map[expr.AlertKey]*Event{
			expr.NewAlertKey("a", opentsdb.TagSet{"h": "x"}): {Status: StUnknown},
			expr.NewAlertKey("a", opentsdb.TagSet{"h": "y"}): {Status: StUnknown},
		},
	}
	s.RunHistory(r)
	s.CheckNotifications()
	gotExpected := false
Loop:
	for {
		select {
		case r := <-nc:
			if r == "a: 2 unknown alerts" {
				gotExpected = true
			} else {
				t.Fatalf("unexpected: %v", r)
			}
		// TODO: remove this silly timeout-based test
		case <-time.After(time.Second):
			break Loop
		}
	}
	if !gotExpected {
		t.Errorf("didn't get expected result")
	}
}

func TestCheckNotifyLog(t *testing.T) {
	s := new(Schedule)
	nc := make(chan string, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := ioutil.ReadAll(r.Body)
		nc <- string(b)
	}))
	defer ts.Close()
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	c, err := conf.New("", fmt.Sprintf(`
		template t {
			subject = {{.Alert.Name}}
		}
		notification n {
			post = http://%s/
		}
		alert a {
			template = t
			critNotification = n
			crit = 1
		}
		alert b {
			template = t
			critNotification = n
			crit = 1
			log = true
		}
	`, u.Host))
	if err != nil {
		t.Fatal(err)
	}
	c.StateFile = ""
	err = s.Init(c)
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Check(nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	s.CheckNotifications()
	gotA := false
	gotB := false
Loop:
	for {
		select {
		case r := <-nc:
			if r == "a" && !gotA {
				gotA = true
			} else if r == "b" && !gotB {
				gotB = true
			} else {
				t.Errorf("unexpected: %v", r)
			}
		// TODO: remove this silly timeout-based test
		case <-time.After(time.Second):
			break Loop
		}
	}
	if !gotA {
		t.Errorf("didn't get expected a")
	}
	if !gotB {
		t.Errorf("didn't get expected b")
	}
	for ak, st := range s.status {
		switch ak {
		case "a{}":
			if !st.Open {
				t.Errorf("expected a to be open")
			}
		case "b{}":
			if st.Open {
				t.Errorf("expected b to be closed")
			}
		default:
			t.Errorf("unexpected alert key %s", ak)
		}
	}
}
