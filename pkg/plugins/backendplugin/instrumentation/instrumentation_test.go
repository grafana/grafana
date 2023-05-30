package instrumentation

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func checkErrorSource(t *testing.T, expected, actual errorSource) {
	t.Helper()
	if expected != actual {
		t.Errorf("expected errorSource to be %v, but got %v", expected, actual)
	}
}

func TestGetErrorSourceForResponse(t *testing.T) {
	t.Run("A response that return an error should return pluginSource", func(t *testing.T) {
		errorSource := getErrorSourceForResponse(backend.DataResponse{Error: fmt.Errorf("error")})
		checkErrorSource(t, pluginSource, errorSource)
	})

	t.Run("A response with an http satus code > 500 should return databaseSource", func(t *testing.T) {
		errorSource := getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 500})
		checkErrorSource(t, databaseSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 503})
		checkErrorSource(t, databaseSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 507})
		checkErrorSource(t, databaseSource, errorSource)
	})

	t.Run("A response with an http satus related to auth (401, 402, 403, 407), should return externalSource", func(t *testing.T) {
		errorSource := getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 401})
		checkErrorSource(t, externalSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 402})
		checkErrorSource(t, externalSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 403})
		checkErrorSource(t, externalSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 407})
		checkErrorSource(t, externalSource, errorSource)
	})

	t.Run("A response with an http satus of 4xx but not related to auth (401, 402, 403, 407), should return pluginSource", func(t *testing.T) {
		errorSource := getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 400})
		checkErrorSource(t, pluginSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 404})
		checkErrorSource(t, pluginSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 405})
		checkErrorSource(t, pluginSource, errorSource)
	})

	t.Run("A response without error and with an http status of 2xx, should return noneSource", func(t *testing.T) {
		errorSource := getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 200})
		checkErrorSource(t, noneSource, errorSource)

		errorSource = getErrorSourceForResponse(backend.DataResponse{Error: nil, Status: 201})
		checkErrorSource(t, noneSource, errorSource)
	})
}

func TestGetErrorSource(t *testing.T) {
	t.Run("If status of backend.QueryDataResponse is statusError, then errorSource is pluginSource ", func(t *testing.T) {
		errorSource := getErrorSource(statusError, nil)
		checkErrorSource(t, pluginSource, errorSource)
	})

	t.Run("If status of backend.QueryDataResponse is statusCancelled, then errorSource is externalSource ", func(t *testing.T) {
		errorSource := getErrorSource(statusCancelled, nil)
		checkErrorSource(t, externalSource, errorSource)
	})

	t.Run("If status of backend.QueryDataResponse is statusOK, then errorSource is the most severe response's errorSource: pluginSource > databaseSource > externalSource > noneSource", func(t *testing.T) {
		errorSource := getErrorSource(statusCancelled, nil)
		checkErrorSource(t, externalSource, errorSource)

		errorSource = getErrorSource(statusOK, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {Error: fmt.Errorf("error")},
				"B": {Error: nil, Status: 200},
			},
		})
		checkErrorSource(t, pluginSource, errorSource)

		errorSource = getErrorSource(statusOK, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {Error: nil, Status: 400},
				"B": {Error: nil, Status: 500},
				"C": {Error: nil, Status: 401},
				"D": {Error: nil, Status: 200},
			},
		})
		checkErrorSource(t, pluginSource, errorSource)

		errorSource = getErrorSource(statusOK, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"B": {Error: nil, Status: 500},
				"C": {Error: nil, Status: 401},
				"D": {Error: nil, Status: 200},
			},
		})
		checkErrorSource(t, databaseSource, errorSource)

		errorSource = getErrorSource(statusOK, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"C": {Error: nil, Status: 401},
				"D": {Error: nil, Status: 200},
			},
		})
		checkErrorSource(t, externalSource, errorSource)

		errorSource = getErrorSource(statusOK, &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"D": {Error: nil, Status: 200},
			},
		})
		checkErrorSource(t, noneSource, errorSource)
	})
}
