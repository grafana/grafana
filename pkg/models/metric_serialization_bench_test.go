package models

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"math/rand"
	"strconv"
	"testing"
)

func getDifferentMetrics(amount int) []*MetricDefinition {
	names := []string{
		"litmus.http.error_state.",
		"litmus.hello.dieter_plaetinck.be",
		"litmus.ok.raintank_dns_error_state_foo_longer",
		"hi.alerting.state",
	}
	intervals := []int64{1, 10, 60}
	tags := []map[string]string{
		{
			"foo":          "bar",
			"endpoint_id":  "25",
			"collector_id": "hi",
		},
		{
			"foo_bar":        "quux",
			"endpoint_id":    "25",
			"collector_id":   "hi",
			"some_other_tag": "ok",
		},
	}
	r := rand.New(rand.NewSource(438))
	out := make([]*MetricDefinition, amount)
	for i := 0; i < amount; i++ {
		out[i] = &MetricDefinition{
			OrgId:      int64(i),
			Name:       names[i%len(names)] + "foo.bar" + strconv.Itoa(i),
			Metric:     names[i%len(names)],
			Interval:   intervals[i%len(intervals)],
			Value:      r.Float64(),
			Unit:       "foo",
			Time:       r.Int63(),
			TargetType: "bleh",
			Tags:       tags[i%len(tags)],
		}
	}
	return out
}

func BenchmarkSerialize3000MetricsJson(b *testing.B) {
	metrics := getDifferentMetrics(3000)
	b.ResetTimer()
	var size int
	for n := 0; n < b.N; n++ {
		i, err := json.Marshal(metrics)
		if err != nil {
			panic(err)
		}
		size = len(i)
	}
	b.Log("final size:", size)
}

func BenchmarkDeSerialize3000MetricsJson(b *testing.B) {
	metrics := getDifferentMetrics(3000)
	data, err := json.Marshal(metrics)
	if err != nil {
		panic(err)
	}
	out := make([]*MetricDefinition, 0)
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		err := json.Unmarshal(data, &out)
		if err != nil {
			panic(err)
		}
	}
}

func BenchmarkSerialize3000MetricsGob(b *testing.B) {
	metrics := getDifferentMetrics(3000)
	var size int
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		var buf bytes.Buffer
		enc := gob.NewEncoder(&buf)
		err := enc.Encode(metrics)
		if err != nil {
			panic(err)
		}
		size = buf.Len()
	}
	b.Log("final size:", size)
}
func BenchmarkDeSerialize3000MetricsGob(b *testing.B) {
	metrics := getDifferentMetrics(3000)
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	err := enc.Encode(metrics)
	if err != nil {
	}
	out := make([]*MetricDefinition, 0)
	data := buf.Bytes()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		buf := bytes.NewBuffer(data)
		dec := gob.NewDecoder(buf)
		err := dec.Decode(&out)
		if err != nil {
			panic(err)
		}
	}
}
