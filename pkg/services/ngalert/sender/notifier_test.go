// THIS FILE IS COPIED FROM UPSTREAM
//
// https://github.com/prometheus/prometheus/blob/293f0c9185260165fd7dabbf8a9e8758b32abeae/notifier/notifier_test.go
//
// Copyright 2013 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//nolint:all
package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	config_util "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"github.com/stretchr/testify/require"
	"go.uber.org/atomic"
	"gopkg.in/yaml.v2"

	"github.com/prometheus/prometheus/discovery"

	"github.com/prometheus/prometheus/config"
	_ "github.com/prometheus/prometheus/discovery/file"
	"github.com/prometheus/prometheus/discovery/targetgroup"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
)

func TestPostPath(t *testing.T) {
	cases := []struct {
		in, out string
	}{
		{
			in:  "",
			out: "/api/v2/alerts",
		},
		{
			in:  "/",
			out: "/api/v2/alerts",
		},
		{
			in:  "/prefix",
			out: "/prefix/api/v2/alerts",
		},
		{
			in:  "/prefix//",
			out: "/prefix/api/v2/alerts",
		},
		{
			in:  "prefix//",
			out: "/prefix/api/v2/alerts",
		},
	}
	for _, c := range cases {
		require.Equal(t, c.out, postPath(c.in, config.AlertmanagerAPIVersionV2))
	}
}

func TestHandlerNextBatch(t *testing.T) {
	h := NewManager(&Options{}, nil)

	for i := range make([]struct{}, 2*maxBatchSize+1) {
		h.queue = append(h.queue, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
	}

	expected := append([]*Alert{}, h.queue...)

	require.NoError(t, alertsEqual(expected[0:maxBatchSize], h.nextBatch()))
	require.NoError(t, alertsEqual(expected[maxBatchSize:2*maxBatchSize], h.nextBatch()))
	require.NoError(t, alertsEqual(expected[2*maxBatchSize:], h.nextBatch()))
	require.Empty(t, h.queue, "Expected queue to be empty but got %d alerts", len(h.queue))
}

func alertsEqual(a, b []*Alert) error {
	if len(a) != len(b) {
		return fmt.Errorf("length mismatch: %v != %v", a, b)
	}
	for i, alert := range a {
		if !labels.Equal(alert.Labels, b[i].Labels) {
			return fmt.Errorf("label mismatch at index %d: %s != %s", i, alert.Labels, b[i].Labels)
		}
	}
	return nil
}

func newTestHTTPServerBuilder(expected *[]*Alert, errc chan<- error, u, p string, status *atomic.Int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		defer func() {
			if err == nil {
				return
			}
			select {
			case errc <- err:
			default:
			}
		}()
		user, pass, _ := r.BasicAuth()
		if user != u || pass != p {
			err = fmt.Errorf("unexpected user/password: %s/%s != %s/%s", user, pass, u, p)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		b, err := io.ReadAll(r.Body)
		if err != nil {
			err = fmt.Errorf("error reading body: %w", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		var alerts []*Alert
		err = json.Unmarshal(b, &alerts)
		if err == nil {
			err = alertsEqual(*expected, alerts)
		}
		w.WriteHeader(int(status.Load()))
	}))
}

func TestHandlerSendAll(t *testing.T) {
	var (
		errc                      = make(chan error, 1)
		expected                  = make([]*Alert, 0, maxBatchSize)
		status1, status2, status3 atomic.Int32
	)
	status1.Store(int32(http.StatusOK))
	status2.Store(int32(http.StatusOK))
	status3.Store(int32(http.StatusOK))

	server1 := newTestHTTPServerBuilder(&expected, errc, "prometheus", "testing_password", &status1)
	server2 := newTestHTTPServerBuilder(&expected, errc, "", "", &status2)
	server3 := newTestHTTPServerBuilder(&expected, errc, "", "", &status3)
	defer server1.Close()
	defer server2.Close()
	defer server3.Close()

	h := NewManager(&Options{}, nil)

	authClient, _ := config_util.NewClientFromConfig(
		config_util.HTTPClientConfig{
			BasicAuth: &config_util.BasicAuth{
				Username: "prometheus",
				Password: "testing_password",
			},
		}, "auth_alertmanager")

	h.alertmanagers = make(map[string]*alertmanagerSet)

	am1Cfg := config.DefaultAlertmanagerConfig
	am1Cfg.Timeout = model.Duration(time.Second)

	am2Cfg := config.DefaultAlertmanagerConfig
	am2Cfg.Timeout = model.Duration(time.Second)

	am3Cfg := config.DefaultAlertmanagerConfig
	am3Cfg.Timeout = model.Duration(time.Second)

	h.alertmanagers["1"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return server1.URL },
			},
		},
		cfg:    &am1Cfg,
		client: authClient,
	}

	h.alertmanagers["2"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return server2.URL },
			},
			alertmanagerMock{
				urlf: func() string { return server3.URL },
			},
		},
		cfg: &am2Cfg,
	}

	h.alertmanagers["3"] = &alertmanagerSet{
		ams: []alertmanager{}, // empty set
		cfg: &am3Cfg,
	}

	for i := range make([]struct{}, maxBatchSize) {
		h.queue = append(h.queue, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
		expected = append(expected, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
	}

	checkNoErr := func() {
		t.Helper()
		select {
		case err := <-errc:
			require.NoError(t, err)
		default:
		}
	}

	// all ams in all sets are up
	require.True(t, h.sendAll(h.queue...), "all sends failed unexpectedly")
	checkNoErr()

	// the only am in set 1 is down
	status1.Store(int32(http.StatusNotFound))
	require.False(t, h.sendAll(h.queue...), "all sends failed unexpectedly")
	checkNoErr()

	// reset it
	status1.Store(int32(http.StatusOK))

	// only one of the ams in set 2 is down
	status2.Store(int32(http.StatusInternalServerError))
	require.True(t, h.sendAll(h.queue...), "all sends succeeded unexpectedly")
	checkNoErr()

	// both ams in set 2 are down
	status3.Store(int32(http.StatusInternalServerError))
	require.False(t, h.sendAll(h.queue...), "all sends succeeded unexpectedly")
	checkNoErr()
}

func TestHandlerSendAllRemapPerAm(t *testing.T) {
	var (
		errc      = make(chan error, 1)
		expected1 = make([]*Alert, 0, maxBatchSize)
		expected2 = make([]*Alert, 0, maxBatchSize)
		expected3 = make([]*Alert, 0)

		status1, status2, status3 atomic.Int32
	)
	status1.Store(int32(http.StatusOK))
	status2.Store(int32(http.StatusOK))
	status3.Store(int32(http.StatusOK))

	server1 := newTestHTTPServerBuilder(&expected1, errc, "", "", &status1)
	server2 := newTestHTTPServerBuilder(&expected2, errc, "", "", &status2)
	server3 := newTestHTTPServerBuilder(&expected3, errc, "", "", &status3)

	defer server1.Close()
	defer server2.Close()
	defer server3.Close()

	h := NewManager(&Options{}, nil)
	h.alertmanagers = make(map[string]*alertmanagerSet)

	am1Cfg := config.DefaultAlertmanagerConfig
	am1Cfg.Timeout = model.Duration(time.Second)

	am2Cfg := config.DefaultAlertmanagerConfig
	am2Cfg.Timeout = model.Duration(time.Second)
	am2Cfg.AlertRelabelConfigs = []*relabel.Config{
		{
			SourceLabels: model.LabelNames{"alertnamedrop"},
			Action:       "drop",
			Regex:        relabel.MustNewRegexp(".+"),
		},
	}

	am3Cfg := config.DefaultAlertmanagerConfig
	am3Cfg.Timeout = model.Duration(time.Second)
	am3Cfg.AlertRelabelConfigs = []*relabel.Config{
		{
			SourceLabels: model.LabelNames{"alertname"},
			Action:       "drop",
			Regex:        relabel.MustNewRegexp(".+"),
		},
	}

	h.alertmanagers = map[string]*alertmanagerSet{
		// Drop no alerts.
		"1": {
			ams: []alertmanager{
				alertmanagerMock{
					urlf: func() string { return server1.URL },
				},
			},
			cfg: &am1Cfg,
		},
		// Drop only alerts with the "alertnamedrop" label.
		"2": {
			ams: []alertmanager{
				alertmanagerMock{
					urlf: func() string { return server2.URL },
				},
			},
			cfg: &am2Cfg,
		},
		// Drop all alerts.
		"3": {
			ams: []alertmanager{
				alertmanagerMock{
					urlf: func() string { return server3.URL },
				},
			},
			cfg: &am3Cfg,
		},
		// Empty list of Alertmanager endpoints.
		"4": {
			ams: []alertmanager{},
			cfg: &config.DefaultAlertmanagerConfig,
		},
	}

	for i := range make([]struct{}, maxBatchSize/2) {
		h.queue = append(h.queue,
			&Alert{
				Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
			},
			&Alert{
				Labels: labels.FromStrings("alertname", "test", "alertnamedrop", strconv.Itoa(i)),
			},
		)

		expected1 = append(expected1,
			&Alert{
				Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
			}, &Alert{
				Labels: labels.FromStrings("alertname", "test", "alertnamedrop", strconv.Itoa(i)),
			},
		)

		expected2 = append(expected2, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
	}

	checkNoErr := func() {
		t.Helper()
		select {
		case err := <-errc:
			require.NoError(t, err)
		default:
		}
	}

	// all ams are up
	require.True(t, h.sendAll(h.queue...), "all sends failed unexpectedly")
	checkNoErr()

	// the only am in set 1 goes down
	status1.Store(int32(http.StatusInternalServerError))
	require.False(t, h.sendAll(h.queue...), "all sends failed unexpectedly")
	checkNoErr()

	// reset set 1
	status1.Store(int32(http.StatusOK))

	// set 3 loses its only am, but all alerts were dropped
	// so there was nothing to send, keeping sendAll true
	status3.Store(int32(http.StatusInternalServerError))
	require.True(t, h.sendAll(h.queue...), "all sends failed unexpectedly")
	checkNoErr()

	// Verify that individual locks are released.
	for k := range h.alertmanagers {
		h.alertmanagers[k].mtx.Lock()
		h.alertmanagers[k].ams = nil
		h.alertmanagers[k].mtx.Unlock()
	}
}

func TestCustomDo(t *testing.T) {
	const testURL = "http://testurl.com/"
	const testBody = "testbody"

	var received bool
	h := NewManager(&Options{
		Do: func(_ context.Context, _ *http.Client, req *http.Request) (*http.Response, error) {
			received = true
			body, err := io.ReadAll(req.Body)

			require.NoError(t, err)

			require.Equal(t, testBody, string(body))

			require.Equal(t, testURL, req.URL.String())

			return &http.Response{
				Body: io.NopCloser(bytes.NewBuffer(nil)),
			}, nil
		},
	}, nil)

	h.sendOne(context.Background(), nil, testURL, []byte(testBody), http.Header{})

	require.True(t, received, "Expected to receive an alert, but didn't")
}

func TestExternalLabels(t *testing.T) {
	h := NewManager(&Options{
		QueueCapacity:  3 * maxBatchSize,
		ExternalLabels: labels.FromStrings("a", "b"),
		RelabelConfigs: []*relabel.Config{
			{
				SourceLabels: model.LabelNames{"alertname"},
				TargetLabel:  "a",
				Action:       "replace",
				Regex:        relabel.MustNewRegexp("externalrelabelthis"),
				Replacement:  "c",
			},
		},
	}, nil)

	// This alert should get the external label attached.
	h.Send(&Alert{
		Labels: labels.FromStrings("alertname", "test"),
	})

	// This alert should get the external label attached, but then set to "c"
	// through relabelling.
	h.Send(&Alert{
		Labels: labels.FromStrings("alertname", "externalrelabelthis"),
	})

	expected := []*Alert{
		{Labels: labels.FromStrings("alertname", "test", "a", "b")},
		{Labels: labels.FromStrings("alertname", "externalrelabelthis", "a", "c")},
	}

	require.NoError(t, alertsEqual(expected, h.queue))
}

func TestHandlerRelabel(t *testing.T) {
	h := NewManager(&Options{
		QueueCapacity: 3 * maxBatchSize,
		RelabelConfigs: []*relabel.Config{
			{
				SourceLabels: model.LabelNames{"alertname"},
				Action:       "drop",
				Regex:        relabel.MustNewRegexp("drop"),
			},
			{
				SourceLabels: model.LabelNames{"alertname"},
				TargetLabel:  "alertname",
				Action:       "replace",
				Regex:        relabel.MustNewRegexp("rename"),
				Replacement:  "renamed",
			},
		},
	}, nil)

	// This alert should be dropped due to the configuration
	h.Send(&Alert{
		Labels: labels.FromStrings("alertname", "drop"),
	})

	// This alert should be replaced due to the configuration
	h.Send(&Alert{
		Labels: labels.FromStrings("alertname", "rename"),
	})

	expected := []*Alert{
		{Labels: labels.FromStrings("alertname", "renamed")},
	}

	require.NoError(t, alertsEqual(expected, h.queue))
}

func TestHandlerQueuing(t *testing.T) {
	var (
		expectedc = make(chan []*Alert)
		called    = make(chan struct{})
		done      = make(chan struct{})
		errc      = make(chan error, 1)
	)

	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		// Notify the test function that we have received something.
		select {
		case called <- struct{}{}:
		case <-done:
			return
		}

		// Wait for the test function to unblock us.
		select {
		case expected := <-expectedc:
			var alerts []*Alert

			b, err := io.ReadAll(r.Body)
			if err != nil {
				panic(err)
			}

			err = json.Unmarshal(b, &alerts)
			if err == nil {
				err = alertsEqual(expected, alerts)
			}
			select {
			case errc <- err:
			default:
			}
		case <-done:
		}
	}))
	defer func() {
		close(done)
		server.Close()
	}()

	h := NewManager(
		&Options{
			QueueCapacity: 3 * maxBatchSize,
		},
		nil,
	)

	h.alertmanagers = make(map[string]*alertmanagerSet)

	am1Cfg := config.DefaultAlertmanagerConfig
	am1Cfg.Timeout = model.Duration(time.Second)

	h.alertmanagers["1"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return server.URL },
			},
		},
		cfg: &am1Cfg,
	}
	go h.Run(nil)
	defer h.Stop()

	var alerts []*Alert
	for i := range make([]struct{}, 20*maxBatchSize) {
		alerts = append(alerts, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
	}

	assertAlerts := func(expected []*Alert) {
		t.Helper()
		for {
			select {
			case <-called:
				expectedc <- expected
			case err := <-errc:
				require.NoError(t, err)
				return
			case <-time.After(5 * time.Second):
				require.FailNow(t, "Alerts were not pushed.")
			}
		}
	}

	// If the batch is larger than the queue capacity, it should be truncated
	// from the front.
	h.Send(alerts[:4*maxBatchSize]...)
	for i := 1; i < 4; i++ {
		assertAlerts(alerts[i*maxBatchSize : (i+1)*maxBatchSize])
	}

	// Send one batch, wait for it to arrive and block the server so the queue fills up.
	h.Send(alerts[:maxBatchSize]...)
	<-called

	// Send several batches while the server is still blocked so the queue
	// fills up to its maximum capacity (3*maxBatchSize). Then check that the
	// queue is truncated in the front.
	h.Send(alerts[1*maxBatchSize : 2*maxBatchSize]...) // this batch should be dropped.
	h.Send(alerts[2*maxBatchSize : 3*maxBatchSize]...)
	h.Send(alerts[3*maxBatchSize : 4*maxBatchSize]...)

	// Send the batch that drops the first one.
	h.Send(alerts[4*maxBatchSize : 5*maxBatchSize]...)

	// Unblock the server.
	expectedc <- alerts[:maxBatchSize]
	select {
	case err := <-errc:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		require.FailNow(t, "Alerts were not pushed.")
	}

	// Verify that we receive the last 3 batches.
	for i := 2; i < 5; i++ {
		assertAlerts(alerts[i*maxBatchSize : (i+1)*maxBatchSize])
	}
}

type alertmanagerMock struct {
	urlf func() string
}

func (a alertmanagerMock) url() *url.URL {
	u, err := url.Parse(a.urlf())
	if err != nil {
		panic(err)
	}
	return u
}

func TestLabelSetNotReused(t *testing.T) {
	tg := makeInputTargetGroup()
	_, _, err := AlertmanagerFromGroup(tg, &config.AlertmanagerConfig{})

	require.NoError(t, err)

	// Target modified during alertmanager extraction
	require.Equal(t, tg, makeInputTargetGroup())
}

func TestReload(t *testing.T) {
	tests := []struct {
		in  *targetgroup.Group
		out string
	}{
		{
			in: &targetgroup.Group{
				Targets: []model.LabelSet{
					{
						"__address__": "alertmanager:9093",
					},
				},
			},
			out: "http://alertmanager:9093/api/v2/alerts",
		},
	}

	n := NewManager(&Options{}, nil)

	cfg := &config.Config{}
	s := `
alerting:
  alertmanagers:
  - static_configs:
`
	err := yaml.UnmarshalStrict([]byte(s), cfg)
	require.NoError(t, err, "Unable to load YAML config.")
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 1)

	err = n.ApplyConfig(cfg, map[string]http.Header{})
	require.NoError(t, err, "Error applying the config.")

	tgs := make(map[string][]*targetgroup.Group)
	for _, tt := range tests {
		for k := range cfg.AlertingConfig.AlertmanagerConfigs.ToMap() {
			tgs[k] = []*targetgroup.Group{
				tt.in,
			}
			break
		}
		n.reload(tgs)
		res := n.Alertmanagers()[0].String()

		require.Equal(t, tt.out, res)
	}
}

func TestDroppedAlertmanagers(t *testing.T) {
	tests := []struct {
		in  *targetgroup.Group
		out string
	}{
		{
			in: &targetgroup.Group{
				Targets: []model.LabelSet{
					{
						"__address__": "alertmanager:9093",
					},
				},
			},
			out: "http://alertmanager:9093/api/v2/alerts",
		},
	}

	n := NewManager(&Options{}, nil)

	cfg := &config.Config{}
	s := `
alerting:
  alertmanagers:
  - static_configs:
    relabel_configs:
      - source_labels: ['__address__']
        regex: 'alertmanager:9093'
        action: drop
`
	err := yaml.UnmarshalStrict([]byte(s), cfg)
	require.NoError(t, err, "Unable to load YAML config.")
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 1)

	err = n.ApplyConfig(cfg, map[string]http.Header{})
	require.NoError(t, err, "Error applying the config.")

	tgs := make(map[string][]*targetgroup.Group)
	for _, tt := range tests {
		for k := range cfg.AlertingConfig.AlertmanagerConfigs.ToMap() {
			tgs[k] = []*targetgroup.Group{
				tt.in,
			}
			break
		}

		n.reload(tgs)
		res := n.DroppedAlertmanagers()[0].String()

		require.Equal(t, res, tt.out)
	}
}

func makeInputTargetGroup() *targetgroup.Group {
	return &targetgroup.Group{
		Targets: []model.LabelSet{
			{
				model.AddressLabel:            model.LabelValue("1.1.1.1:9090"),
				model.LabelName("notcommon1"): model.LabelValue("label"),
			},
		},
		Labels: model.LabelSet{
			model.LabelName("common"): model.LabelValue("label"),
		},
		Source: "testsource",
	}
}

func TestLabelsToOpenAPILabelSet(t *testing.T) {
	require.Equal(t, models.LabelSet{"aaa": "111", "bbb": "222"}, labelsToOpenAPILabelSet(labels.FromStrings("aaa", "111", "bbb", "222")))
}

// TestHangingNotifier ensures that the notifier takes into account SD changes even when there are
// queued alerts. This test reproduces the issue described in https://github.com/prometheus/prometheus/issues/13676.
// and https://github.com/prometheus/prometheus/issues/8768.
func TestHangingNotifier(t *testing.T) {
	const (
		batches     = 100
		alertsCount = maxBatchSize * batches
	)

	var (
		sendTimeout = 100 * time.Millisecond
		sdUpdatert  = sendTimeout / 2

		done = make(chan struct{})
	)

	defer func() {
		close(done)
	}()

	// Set up a faulty Alertmanager.
	var faultyCalled atomic.Bool
	faultyServer := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		faultyCalled.Store(true)
		select {
		case <-done:
		case <-time.After(time.Hour):
		}
	}))
	faultyURL, err := url.Parse(faultyServer.URL)
	require.NoError(t, err)

	// Set up a functional Alertmanager.
	var functionalCalled atomic.Bool
	functionalServer := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		functionalCalled.Store(true)
	}))
	functionalURL, err := url.Parse(functionalServer.URL)
	require.NoError(t, err)

	// Initialize the discovery manager
	// This is relevant as the updates aren't sent continually in real life, but only each updatert.
	// The old implementation of TestHangingNotifier didn't take that into account.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reg := prometheus.NewRegistry()
	sdMetrics, err := discovery.RegisterSDMetrics(reg, discovery.NewRefreshMetrics(reg))
	require.NoError(t, err)
	sdManager := discovery.NewManager(
		ctx,
		promslog.NewNopLogger(),
		reg,
		sdMetrics,
		discovery.Name("sd-manager"),
		discovery.Updatert(sdUpdatert),
	)
	go sdManager.Run()

	// Set up the notifier with both faulty and functional Alertmanagers.
	notifier := NewManager(
		&Options{
			QueueCapacity: alertsCount,
		},
		nil,
	)
	notifier.alertmanagers = make(map[string]*alertmanagerSet)
	amCfg := config.DefaultAlertmanagerConfig
	amCfg.Timeout = model.Duration(sendTimeout)
	notifier.alertmanagers["config-0"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return faultyURL.String() },
			},
			alertmanagerMock{
				urlf: func() string { return functionalURL.String() },
			},
		},
		cfg:     &amCfg,
		metrics: notifier.metrics,
	}
	go notifier.Run(sdManager.SyncCh())
	defer notifier.Stop()

	require.Len(t, notifier.Alertmanagers(), 2)

	// Enqueue the alerts.
	var alerts []*Alert
	for i := range make([]struct{}, alertsCount) {
		alerts = append(alerts, &Alert{
			Labels: labels.FromStrings("alertname", strconv.Itoa(i)),
		})
	}
	notifier.Send(alerts...)

	// Wait for the Alertmanagers to start receiving alerts.
	// 10*sdUpdatert is used as an arbitrary timeout here.
	timeout := time.After(10 * sdUpdatert)
loop1:
	for {
		select {
		case <-timeout:
			t.Fatalf("Timeout waiting for the alertmanagers to be reached for the first time.")
		default:
			if faultyCalled.Load() && functionalCalled.Load() {
				break loop1
			}
		}
	}

	// Request to remove the faulty Alertmanager.
	c := map[string]discovery.Configs{
		"config-0": {
			discovery.StaticConfig{
				&targetgroup.Group{
					Targets: []model.LabelSet{
						{
							model.AddressLabel: model.LabelValue(functionalURL.Host),
						},
					},
				},
			},
		},
	}
	require.NoError(t, sdManager.ApplyConfig(c))

	// The notifier should not wait until the alerts queue is empty to apply the discovery changes
	// A faulty Alertmanager could cause each alert sending cycle to take up to AlertmanagerConfig.Timeout
	// The queue may never be emptied, as the arrival rate could be larger than the departure rate
	// It could even overflow and alerts could be dropped.
	timeout = time.After(batches * sendTimeout)
loop2:
	for {
		select {
		case <-timeout:
			t.Fatalf("Timeout, the faulty alertmanager not removed on time.")
		default:
			// The faulty alertmanager was dropped.
			if len(notifier.Alertmanagers()) == 1 {
				// Prevent from TOCTOU.
				require.Positive(t, notifier.queueLen())
				break loop2
			}
			require.Positive(t, notifier.queueLen(), "The faulty alertmanager wasn't dropped before the alerts queue was emptied.")
		}
	}
}

func TestStop_DrainingDisabled(t *testing.T) {
	releaseReceiver := make(chan struct{})
	receiverReceivedRequest := make(chan struct{}, 2)
	alertsReceived := atomic.NewInt64(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Let the test know we've received a request.
		receiverReceivedRequest <- struct{}{}

		var alerts []*Alert

		b, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		err = json.Unmarshal(b, &alerts)
		require.NoError(t, err)

		alertsReceived.Add(int64(len(alerts)))

		// Wait for the test to release us.
		<-releaseReceiver

		w.WriteHeader(http.StatusOK)
	}))
	defer func() {
		server.Close()
	}()

	m := NewManager(
		&Options{
			QueueCapacity:   10,
			DrainOnShutdown: false,
		},
		nil,
	)

	m.alertmanagers = make(map[string]*alertmanagerSet)

	am1Cfg := config.DefaultAlertmanagerConfig
	am1Cfg.Timeout = model.Duration(time.Second)

	m.alertmanagers["1"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return server.URL },
			},
		},
		cfg: &am1Cfg,
	}

	notificationManagerStopped := make(chan struct{})

	go func() {
		defer close(notificationManagerStopped)
		m.Run(nil)
	}()

	// Queue two alerts. The first should be immediately sent to the receiver, which should block until we release it later.
	m.Send(&Alert{Labels: labels.FromStrings(labels.AlertName, "alert-1")})

	select {
	case <-receiverReceivedRequest:
		// Nothing more to do.
	case <-time.After(time.Second):
		require.FailNow(t, "gave up waiting for receiver to receive notification of first alert")
	}

	m.Send(&Alert{Labels: labels.FromStrings(labels.AlertName, "alert-2")})

	// Stop the notification manager, pause to allow the shutdown to be observed, and then allow the receiver to proceed.
	m.Stop()
	time.Sleep(time.Second)
	close(releaseReceiver)

	// Wait for the notification manager to stop and confirm only the first notification was sent.
	// The second notification should be dropped.
	select {
	case <-notificationManagerStopped:
		// Nothing more to do.
	case <-time.After(time.Second):
		require.FailNow(t, "gave up waiting for notification manager to stop")
	}

	require.Equal(t, int64(1), alertsReceived.Load())
}

func TestStop_DrainingEnabled(t *testing.T) {
	releaseReceiver := make(chan struct{})
	receiverReceivedRequest := make(chan struct{}, 2)
	alertsReceived := atomic.NewInt64(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Let the test know we've received a request.
		receiverReceivedRequest <- struct{}{}

		var alerts []*Alert

		b, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		err = json.Unmarshal(b, &alerts)
		require.NoError(t, err)

		alertsReceived.Add(int64(len(alerts)))

		// Wait for the test to release us.
		<-releaseReceiver

		w.WriteHeader(http.StatusOK)
	}))
	defer func() {
		server.Close()
	}()

	m := NewManager(
		&Options{
			QueueCapacity:   10,
			DrainOnShutdown: true,
		},
		nil,
	)

	m.alertmanagers = make(map[string]*alertmanagerSet)

	am1Cfg := config.DefaultAlertmanagerConfig
	am1Cfg.Timeout = model.Duration(time.Second)

	m.alertmanagers["1"] = &alertmanagerSet{
		ams: []alertmanager{
			alertmanagerMock{
				urlf: func() string { return server.URL },
			},
		},
		cfg: &am1Cfg,
	}

	notificationManagerStopped := make(chan struct{})

	go func() {
		defer close(notificationManagerStopped)
		m.Run(nil)
	}()

	// Queue two alerts. The first should be immediately sent to the receiver, which should block until we release it later.
	m.Send(&Alert{Labels: labels.FromStrings(labels.AlertName, "alert-1")})

	select {
	case <-receiverReceivedRequest:
		// Nothing more to do.
	case <-time.After(time.Second):
		require.FailNow(t, "gave up waiting for receiver to receive notification of first alert")
	}

	m.Send(&Alert{Labels: labels.FromStrings(labels.AlertName, "alert-2")})

	// Stop the notification manager and allow the receiver to proceed.
	m.Stop()
	close(releaseReceiver)

	// Wait for the notification manager to stop and confirm both notifications were sent.
	select {
	case <-notificationManagerStopped:
		// Nothing more to do.
	case <-time.After(200 * time.Millisecond):
		require.FailNow(t, "gave up waiting for notification manager to stop")
	}

	require.Equal(t, int64(2), alertsReceived.Load())
}

func TestIntegrationApplyConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	targetURL := "alertmanager:9093"
	targetGroup := &targetgroup.Group{
		Targets: []model.LabelSet{
			{
				"__address__": model.LabelValue(targetURL),
			},
		},
	}
	alertmanagerURL := fmt.Sprintf("http://%s/api/v2/alerts", targetURL)

	n := NewManager(&Options{}, nil)
	cfg := &config.Config{}
	s := `
alerting:
  alertmanagers:
  - file_sd_configs:
    - files:
      - foo.json
`
	// 1. Ensure known alertmanagers are not dropped during ApplyConfig.
	require.NoError(t, yaml.UnmarshalStrict([]byte(s), cfg))
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 1)

	// First, apply the config and reload.
	require.NoError(t, n.ApplyConfig(cfg, map[string]http.Header{}))
	tgs := map[string][]*targetgroup.Group{"config-0": {targetGroup}}
	n.reload(tgs)
	require.Len(t, n.Alertmanagers(), 1)
	require.Equal(t, alertmanagerURL, n.Alertmanagers()[0].String())

	// Reapply the config.
	require.NoError(t, n.ApplyConfig(cfg, map[string]http.Header{}))
	// Ensure the known alertmanagers are not dropped.
	require.Len(t, n.Alertmanagers(), 1)
	require.Equal(t, alertmanagerURL, n.Alertmanagers()[0].String())

	// 2. Ensure known alertmanagers are not dropped during ApplyConfig even when
	// the config order changes.
	s = `
alerting:
  alertmanagers:
  - static_configs:
  - file_sd_configs:
    - files:
      - foo.json
`
	require.NoError(t, yaml.UnmarshalStrict([]byte(s), cfg))
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 2)

	require.NoError(t, n.ApplyConfig(cfg, map[string]http.Header{}))
	require.Len(t, n.Alertmanagers(), 1)
	// Ensure no unnecessary alertmanagers are injected.
	require.Empty(t, n.alertmanagers["config-0"].ams)
	// Ensure the config order is taken into account.
	ams := n.alertmanagers["config-1"].ams
	require.Len(t, ams, 1)
	require.Equal(t, alertmanagerURL, ams[0].url().String())

	// 3. Ensure known alertmanagers are reused for new config with identical AlertmanagerConfig.
	s = `
alerting:
  alertmanagers:
  - file_sd_configs:
    - files:
      - foo.json
  - file_sd_configs:
    - files:
      - foo.json
`
	require.NoError(t, yaml.UnmarshalStrict([]byte(s), cfg))
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 2)

	require.NoError(t, n.ApplyConfig(cfg, map[string]http.Header{}))
	require.Len(t, n.Alertmanagers(), 2)
	for cfgIdx := range 2 {
		ams := n.alertmanagers[fmt.Sprintf("config-%d", cfgIdx)].ams
		require.Len(t, ams, 1)
		require.Equal(t, alertmanagerURL, ams[0].url().String())
	}

	// 4. Ensure known alertmanagers are reused only for identical AlertmanagerConfig.
	s = `
alerting:
  alertmanagers:
  - file_sd_configs:
    - files:
      - foo.json
    path_prefix: /bar
  - file_sd_configs:
    - files:
      - foo.json
    relabel_configs:
    - source_labels: ['__address__']
      regex: 'doesntmatter:1234'
      action: drop
`
	require.NoError(t, yaml.UnmarshalStrict([]byte(s), cfg))
	require.Len(t, cfg.AlertingConfig.AlertmanagerConfigs, 2)

	require.NoError(t, n.ApplyConfig(cfg, map[string]http.Header{}))
	require.Empty(t, n.Alertmanagers())
}
