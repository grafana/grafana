package elasticsearch

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// To avoid compiler optimizations eliminating the function under test
// we are storing the result to a package level variable
var Result queryDataTestResult

func BenchmarkSimpleMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_simple")
	responseBytes := getResponseBytesFromTestsDataFile("metric_simple")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func BenchmarkComplexMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_complex")
	responseBytes := getResponseBytesFromTestsDataFile("metric_complex")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func BenchmarkMultiMetricResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("metric_multi")
	responseBytes := getResponseBytesFromTestsDataFile("metric_multi")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func BenchmarkRawDataResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_data")
	responseBytes := getResponseBytesFromTestsDataFile("raw_data")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func BenchmarkRawDocumentResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("raw_document")
	responseBytes := getResponseBytesFromTestsDataFile("raw_document")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func BenchmarkLogsResponse(b *testing.B) {
	queriesBytes := getQueriesBytesFromTestsDataFile("logs")
	responseBytes := getResponseBytesFromTestsDataFile("logs")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := queryDataTest(queriesBytes, responseBytes)
		require.NoError(b, err)
		Result = result
	}
}

func getQueriesBytesFromTestsDataFile(fileName string) []byte {
	queriesName := filepath.Join("testdata_response", fileName+".queries.json")
	queriesBytes, _ := os.ReadFile(filepath.Clean(queriesName))
	return queriesBytes
}

func getResponseBytesFromTestsDataFile(fileName string) []byte {
	responseName := filepath.Join("testdata_response", fileName+".response.json")
	responseBytes, _ := os.ReadFile(filepath.Clean(responseName))
	return responseBytes
}
