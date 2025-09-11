package graphite

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type resourceHandler func(context.Context, *datasourceInfo, []byte) ([]byte, int, error)

func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/events", s.handleResourceReq(s.handleEvents))
	return mux
}

func (s *Service) handleResourceReq(handlerFn resourceHandler) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		pluginCtx := backend.PluginConfigFromContext(req.Context())
		ctx := req.Context()
		dsInfo, err := s.getDSInfo(ctx, pluginCtx)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		defer func() {
			if err := req.Body.Close(); err != nil {
				s.logger.Warn("Failed to close response body", "err", err)
				writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
				return
			}
		}()
		requestBody, err := io.ReadAll(req.Body)
		if err != nil {
			s.logger.Error("Failed to read events request body", "error", err)
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		if handlerFn == nil {
			writeErrorResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
			return
		}

		response, statusCode, err := handlerFn(ctx, dsInfo, requestBody)
		if err != nil {
			writeErrorResponse(rw, statusCode, fmt.Sprintf("failed to handle resource request: %v", err))
			return
		}

		rw.WriteHeader(statusCode)
		_, err = rw.Write(response)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("failed to write events response: %v", err))
			return
		}
	}
}

func (s *Service) handleEvents(ctx context.Context, dsInfo *datasourceInfo, requestBody []byte) ([]byte, int, error) {
	eventsRequestJson := GraphiteEventsRequest{}
	err := json.Unmarshal(requestBody, &eventsRequestJson)
	if err != nil {
		s.logger.Error("Failed to unmarshal events request body to JSON", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	eventsUrl, err := url.Parse(fmt.Sprintf("%s/events/get_data", dsInfo.URL))
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	queryValues := eventsUrl.Query()
	queryValues.Set("from", eventsRequestJson.From)
	queryValues.Set("until", eventsRequestJson.Until)
	if eventsRequestJson.Tags != "" {
		queryValues.Set("tags", eventsRequestJson.Tags)
	}

	eventsUrl.RawQuery = queryValues.Encode()

	p := eventsUrl.String()
	graphiteReq, err := http.NewRequestWithContext(ctx, http.MethodGet, p, nil)
	if err != nil {
		s.logger.Info("Failed to create request", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create request: %v", err)
	}

	_, span := tracing.DefaultTracer().Start(ctx, "graphite events")
	defer span.End()
	span.SetAttributes(
		attribute.Int64("datasource_id", dsInfo.Id),
	)
	res, err := dsInfo.HTTPClient.Do(graphiteReq)
	if res != nil {
		span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to complete events request: %v", err)
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	encoding := res.Header.Get("Content-Encoding")
	body, err := decode(encoding, res.Body)
	if err != nil {
		return nil, res.StatusCode, fmt.Errorf("failed to read events response: %v", err)
	}

	events := []GraphiteEventsResponse{}
	err = json.Unmarshal(body, &events)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal events response: %v", err)
	}

	// We construct this struct to avoid frontend changes.
	graphiteEventsResponse, err := json.Marshal(map[string][]GraphiteEventsResponse{
		"data": events,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal events response: %s", err)
	}

	return graphiteEventsResponse, res.StatusCode, nil
}

func writeErrorResponse(rw http.ResponseWriter, code int, msg string) {
	rw.WriteHeader(code)
	errorBody := map[string]string{
		"error": msg,
	}
	jsonRes, _ := json.Marshal(errorBody)
	_, err := rw.Write(jsonRes)
	if err != nil {
		backend.Logger.Error("Unable to write HTTP response", "error", err)
	}
}
