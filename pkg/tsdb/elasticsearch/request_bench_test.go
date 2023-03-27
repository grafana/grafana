package elasticsearch

import (
	"testing"
	"time"
)


func BenchmarkSimpleMetricRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_simple")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}

func BenchmarkComplexMetricRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_complex")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}

func BenchmarkMultiMetricRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_multi")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}

func BenchmarkRawDataRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_data")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}

func BenchmarkRawDocumentRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_document")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}

func BenchmarkLogsRequest(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("logs")
	c := newFakeClient()
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		executeElasticsearchDataQuery(c, string(queriesBytes), from, to)
	}
}