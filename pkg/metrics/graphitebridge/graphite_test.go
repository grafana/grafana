package graphitebridge

import (
	"bufio"
	"bytes"
	"io"
	"net"
	"regexp"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/model"
)

func TestCountersAsDelta(t *testing.T) {
	b, _ := NewBridge(&Config{
		URL:             "localhost:12345",
		CountersAsDelta: true,
	})
	ty := dto.MetricType(0)
	mf := &dto.MetricFamily{
		Type:   &ty,
		Metric: []*dto.Metric{},
	}
	m := model.Metric{}

	var want float64
	var got float64
	want = float64(1)
	got = b.replaceCounterWithDelta(mf, m, model.SampleValue(1))
	if got != want {
		t.Fatalf("want %v got %v", want, got)
	}

	got = b.replaceCounterWithDelta(mf, m, model.SampleValue(2))
	if got != want {
		t.Fatalf("want %v got %v", want, got)
	}
}

func TestCountersAsDeltaDisabled(t *testing.T) {
	b, _ := NewBridge(&Config{
		URL:             "localhost:12345",
		CountersAsDelta: false,
	})
	ty := dto.MetricType(0)
	mf := &dto.MetricFamily{
		Type:   &ty,
		Metric: []*dto.Metric{},
	}
	m := model.Metric{}

	var want float64
	var got float64
	want = float64(1)
	got = b.replaceCounterWithDelta(mf, m, model.SampleValue(1))
	if got != want {
		t.Fatalf("want %v got %v", want, got)
	}

	want = float64(2)
	got = b.replaceCounterWithDelta(mf, m, model.SampleValue(2))
	if got != want {
		t.Fatalf("want %v got %v", want, got)
	}
}

func TestSanitize(t *testing.T) {
	testCases := []struct {
		in, out string
	}{
		{in: "hello", out: "hello"},
		{in: "hE/l1o", out: "hE_l1o"},
		{in: "he,*ll(.o", out: "he_ll_o"},
		{in: "hello_there%^&", out: "hello_there_"},
	}

	var buf bytes.Buffer
	w := bufio.NewWriter(&buf)

	for i, tc := range testCases {
		if err := writeSanitized(w, tc.in); err != nil {
			t.Fatalf("write failed: %v", err)
		}
		if err := w.Flush(); err != nil {
			t.Fatalf("flush failed: %v", err)
		}

		if want, got := tc.out, buf.String(); want != got {
			t.Fatalf("test case index %d: got sanitized string %s, want %s", i, got, want)
		}

		buf.Reset()
	}
}

func TestSanitizePrefix(t *testing.T) {
	testCases := []struct {
		in, out string
	}{
		{in: "service.prod.", out: "service.prod."},
		{in: "service.prod", out: "service.prod"},
	}

	var buf bytes.Buffer
	w := bufio.NewWriter(&buf)

	for i, tc := range testCases {
		if err := writePrefix(w, tc.in); err != nil {
			t.Fatalf("write failed: %v", err)
		}
		if err := w.Flush(); err != nil {
			t.Fatalf("flush failed: %v", err)
		}

		if want, got := tc.out, buf.String(); want != got {
			t.Fatalf("test case index %d: got sanitized string %s, want %s", i, got, want)
		}

		buf.Reset()
	}
}

func TestWriteSummary(t *testing.T) {
	sumVec := prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:        "name",
			Help:        "docstring",
			Namespace:   "grafana",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
			Objectives:  map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
		[]string{"labelname"},
	)

	reg := prometheus.NewRegistry()
	reg.MustRegister(sumVec)

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("cannot create bridge. err: %v", err)
	}

	sumVec.WithLabelValues("val1").Observe(float64(10))
	sumVec.WithLabelValues("val1").Observe(float64(20))
	sumVec.WithLabelValues("val1").Observe(float64(30))
	sumVec.WithLabelValues("val2").Observe(float64(20))
	sumVec.WithLabelValues("val2").Observe(float64(30))
	sumVec.WithLabelValues("val2").Observe(float64(40))

	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	now := model.Time(1477043083)
	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", now)
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := `prefix.name.constname.constvalue.labelname.val1.quantile.0_5 20 1477043
prefix.name.constname.constvalue.labelname.val1.quantile.0_9 30 1477043
prefix.name.constname.constvalue.labelname.val1.quantile.0_99 30 1477043
prefix.name_sum.constname.constvalue.labelname.val1 60 1477043
prefix.name_count.constname.constvalue.labelname.val1.count 3 1477043
prefix.name.constname.constvalue.labelname.val2.quantile.0_5 30 1477043
prefix.name.constname.constvalue.labelname.val2.quantile.0_9 40 1477043
prefix.name.constname.constvalue.labelname.val2.quantile.0_99 40 1477043
prefix.name_sum.constname.constvalue.labelname.val2 90 1477043
prefix.name_count.constname.constvalue.labelname.val2.count 3 1477043
`

	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}
}

func TestWriteHistogram(t *testing.T) {
	histVec := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:        "name",
			Help:        "docstring",
			Namespace:   "grafana",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
			Buckets:     []float64{0.01, 0.02, 0.05, 0.1},
		},
		[]string{"labelname"},
	)

	reg := prometheus.NewRegistry()
	reg.MustRegister(histVec)

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	histVec.WithLabelValues("val1").Observe(float64(10))
	histVec.WithLabelValues("val1").Observe(float64(20))
	histVec.WithLabelValues("val1").Observe(float64(30))
	histVec.WithLabelValues("val2").Observe(float64(20))
	histVec.WithLabelValues("val2").Observe(float64(30))
	histVec.WithLabelValues("val2").Observe(float64(40))

	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	now := model.Time(1477043083)
	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", now)
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := `prefix.name_bucket.constname.constvalue.labelname.val1.le.0_01 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val1.le.0_02 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val1.le.0_05 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val1.le.0_1 0 1477043
prefix.name_sum.constname.constvalue.labelname.val1.sum 60 1477043
prefix.name_count.constname.constvalue.labelname.val1.count 3 1477043
prefix.name_bucket.constname.constvalue.labelname.val1.le._Inf 3 1477043
prefix.name_bucket.constname.constvalue.labelname.val2.le.0_01 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val2.le.0_02 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val2.le.0_05 0 1477043
prefix.name_bucket.constname.constvalue.labelname.val2.le.0_1 0 1477043
prefix.name_sum.constname.constvalue.labelname.val2.sum 90 1477043
prefix.name_count.constname.constvalue.labelname.val2.count 3 1477043
prefix.name_bucket.constname.constvalue.labelname.val2.le._Inf 3 1477043
`
	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}
}

func TestCounterVec(t *testing.T) {
	cntVec := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:        "page_response",
			Namespace:   "grafana",
			Help:        "docstring",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		},
		[]string{"labelname"},
	)

	apicntVec := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:        "api_response",
			Namespace:   "grafana",
			Help:        "docstring",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		},
		[]string{"labelname"},
	)

	reg := prometheus.NewRegistry()
	reg.MustRegister(cntVec)
	reg.MustRegister(apicntVec)

	cntVec.WithLabelValues("val1").Inc()
	cntVec.WithLabelValues("val2").Inc()
	apicntVec.WithLabelValues("val1").Inc()
	apicntVec.WithLabelValues("val2").Inc()

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	// first collect
	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477043083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := `prefix.api.response.constname.constvalue.labelname.val1.count 1 1477043
prefix.api.response.constname.constvalue.labelname.val2.count 1 1477043
prefix.page.response.constname.constvalue.labelname.val1.count 1 1477043
prefix.page.response.constname.constvalue.labelname.val2.count 1 1477043
`
	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}

	//next collect
	cntVec.WithLabelValues("val1").Inc()
	cntVec.WithLabelValues("val2").Inc()
	apicntVec.WithLabelValues("val1").Inc()
	apicntVec.WithLabelValues("val2").Inc()

	mfs, err = reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	buf = bytes.Buffer{}
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477053083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want2 := `prefix.api.response.constname.constvalue.labelname.val1.count 1 1477053
prefix.api.response.constname.constvalue.labelname.val2.count 1 1477053
prefix.page.response.constname.constvalue.labelname.val1.count 1 1477053
prefix.page.response.constname.constvalue.labelname.val2.count 1 1477053
`
	if got := buf.String(); want2 != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want2, got)
	}
}

func TestCounter(t *testing.T) {
	cntVec := prometheus.NewCounter(
		prometheus.CounterOpts{
			Name:        "page_response",
			Help:        "docstring",
			Namespace:   "grafana",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		})

	reg := prometheus.NewRegistry()
	reg.MustRegister(cntVec)

	cntVec.Inc()

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	// first collect
	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477043083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := "prefix.page.response.constname.constvalue.count 1 1477043\n"
	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}

	//next collect
	cntVec.Inc()

	mfs, err = reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	buf = bytes.Buffer{}
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477053083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want2 := "prefix.page.response.constname.constvalue.count 1 1477053\n"
	if got := buf.String(); want2 != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want2, got)
	}
}

func TestTrimGrafanaNamespace(t *testing.T) {
	cntVec := prometheus.NewCounter(
		prometheus.CounterOpts{
			Name:        "http_request_total",
			Help:        "docstring",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		})

	reg := prometheus.NewRegistry()
	reg.MustRegister(cntVec)

	cntVec.Inc()

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	// first collect
	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477043083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := "prefix.http_request_total.constname.constvalue.count 1 1477043\n"
	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}
}

func TestSkipNanValues(t *testing.T) {
	cntVec := prometheus.NewSummary(
		prometheus.SummaryOpts{
			Name:        "http_request_total",
			Help:        "docstring",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		})

	reg := prometheus.NewRegistry()
	reg.MustRegister(cntVec)

	b, err := NewBridge(&Config{
		URL:             "localhost:8080",
		Gatherer:        reg,
		CountersAsDelta: true,
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	// first collect
	mfs, err := reg.Gather()
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	var buf bytes.Buffer
	err = b.writeMetrics(&buf, mfs, "prefix.", model.Time(1477043083))
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	want := `prefix.http_request_total_sum.constname.constvalue 0 1477043
prefix.http_request_total_count.constname.constvalue.count 0 1477043
`

	if got := buf.String(); want != got {
		t.Fatalf("wanted \n%s\n, got \n%s\n", want, got)
	}
}

func TestPush(t *testing.T) {
	reg := prometheus.NewRegistry()
	cntVec := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:        "name",
			Help:        "docstring",
			Namespace:   "grafana",
			ConstLabels: prometheus.Labels{"constname": "constvalue"},
		},
		[]string{"labelname"},
	)
	cntVec.WithLabelValues("val1").Inc()
	cntVec.WithLabelValues("val2").Inc()
	reg.MustRegister(cntVec)

	host := "localhost"
	port := ":56789"
	b, err := NewBridge(&Config{
		URL:      host + port,
		Gatherer: reg,
		Prefix:   "prefix.",
	})
	if err != nil {
		t.Fatalf("error creating bridge: %v", err)
	}

	nmg, err := newMockGraphite(port)
	if err != nil {
		t.Fatalf("error creating mock graphite: %v", err)
	}
	defer nmg.Close()

	err = b.Push()
	if err != nil {
		t.Fatalf("error pushing: %v", err)
	}

	wants := []string{
		"prefix.name.constname.constvalue.labelname.val1.count 1",
		"prefix.name.constname.constvalue.labelname.val2.count 1",
	}

	select {
	case got := <-nmg.readc:
		for _, want := range wants {
			matched, err := regexp.MatchString(want, got)
			if err != nil {
				t.Fatalf("error pushing: %v", err)
			}
			if !matched {
				t.Fatalf("missing metric:\nno match for %s received by server:\n%s", want, got)
			}
		}
		return
	case err := <-nmg.errc:
		t.Fatalf("error reading push: %v", err)
	case <-time.After(50 * time.Millisecond):
		t.Fatalf("no result from graphite server")
	}
}

func newMockGraphite(port string) (*mockGraphite, error) {
	readc := make(chan string)
	errc := make(chan error)
	ln, err := net.Listen("tcp", port)
	if err != nil {
		return nil, err
	}

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			errc <- err
		}
		var b bytes.Buffer
		io.Copy(&b, conn)
		readc <- b.String()
	}()

	return &mockGraphite{
		readc:    readc,
		errc:     errc,
		Listener: ln,
	}, nil
}

type mockGraphite struct {
	readc chan string
	errc  chan error

	net.Listener
}
