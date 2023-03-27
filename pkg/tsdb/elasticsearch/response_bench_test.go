package elasticsearch

import (
	"os"
	"path/filepath"
	"testing"
)

func BenchmarkSimpleMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_simple")
	responseBytes := getResponseBytesFromTestsDataFile("metric_simple")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func BenchmarkComplexMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_complex")
	responseBytes := getResponseBytesFromTestsDataFile("metric_complex")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func BenchmarkMultiMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_multi")
	responseBytes := getResponseBytesFromTestsDataFile("metric_multi")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func BenchmarkRawDataResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_data")
	responseBytes := getResponseBytesFromTestsDataFile("raw_data")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func BenchmarkRawDocumentResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_document")
	responseBytes := getResponseBytesFromTestsDataFile("raw_document")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func BenchmarkLogsResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("logs")
	responseBytes := getResponseBytesFromTestsDataFile("logs")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		queryDataTest(queriesBytes, responseBytes)
	}
}

func getQueriesBytesFromTestsDataFile(fileName string) []byte {
	queriesName := filepath.Join("testdata_response", fileName + ".queries.json")
	queriesBytes, _ := os.ReadFile(filepath.Clean(queriesName))
	return queriesBytes
}

func getResponseBytesFromTestsDataFile(fileName string) []byte {
	responseName := filepath.Join("testdata_response", fileName + ".response.json")
	responseBytes, _ := os.ReadFile(filepath.Clean(responseName))
	return responseBytes
}