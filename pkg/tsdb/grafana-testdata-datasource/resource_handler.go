package testdatasource

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds"
)

func (s *Service) registerRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.testGetHandler)
	mux.HandleFunc("/scenarios", s.getScenariosHandler)
	mux.HandleFunc("/stream", s.testStreamHandler)
	mux.Handle("/test", createJSONHandler(s.logger))
	mux.Handle("/test/json", createJSONHandler(s.logger))
	mux.HandleFunc("/boom", s.testPanicHandler)
	mux.HandleFunc("/sims", s.sims.GetSimulationHandler)
	mux.HandleFunc("/sim/", s.sims.GetSimulationHandler)
	return mux
}

func (s *Service) testGetHandler(rw http.ResponseWriter, req *http.Request) {
	ctxLogger := s.logger.FromContext(req.Context())
	ctxLogger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	if req.Method != http.MethodGet {
		return
	}

	if _, err := rw.Write([]byte("Hello world from test datasource!")); err != nil {
		ctxLogger.Error("Failed to write response", "error", err)
		return
	}
	rw.WriteHeader(http.StatusOK)
}

func (s *Service) getScenariosHandler(rw http.ResponseWriter, req *http.Request) {
	ctxLogger := s.logger.FromContext(req.Context())
	result := make([]any, 0)

	scenarioIds := make([]string, 0)
	for id := range s.scenarios {
		scenarioIds = append(scenarioIds, string(id))
	}
	sort.Strings(scenarioIds)

	for _, scenarioID := range scenarioIds {
		scenario := s.scenarios[kinds.TestDataQueryType(scenarioID)]
		result = append(result, map[string]any{
			"id":          scenario.ID,
			"name":        scenario.Name,
			"description": scenario.Description,
			"stringInput": scenario.StringInput,
		})
	}

	bytes, err := json.Marshal(&result)
	if err != nil {
		ctxLogger.Error("Failed to marshal response body to JSON", "error", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	if _, err := rw.Write(bytes); err != nil {
		ctxLogger.Error("Failed to write response", "error", err)
	}
}

func (s *Service) testStreamHandler(rw http.ResponseWriter, req *http.Request) {
	ctxLogger := s.logger.FromContext(req.Context())
	ctxLogger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	header := rw.Header()
	header.Set("Cache-Control", "no-store")
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Content-Type", "text/plain")

	writeError := func(code int, message string) {
		rw.WriteHeader(code)
		_, _ = rw.Write([]byte(message))
	}

	if req.Method != http.MethodGet {
		writeError(http.StatusMethodNotAllowed, "only supports get")
		return
	}

	var err error
	query := req.URL.Query()
	count := 10
	if query.Has("count") {
		count, err = strconv.Atoi(query.Get("count"))
		if err != nil {
			writeError(http.StatusBadRequest, "invalid count value")
			return
		}
	}

	start := 1
	if query.Has("start") {
		start, err = strconv.Atoi(query.Get("start"))
		if err != nil {
			writeError(http.StatusBadRequest, "invalid start value")
			return
		}
	}

	flush := 100 // flush 100% of the time
	if query.Has("flush") {
		flush, err = strconv.Atoi(query.Get("flush"))
		if err != nil {
			writeError(http.StatusBadRequest, "invalid flush value")
			return
		}
		if flush > 100 || flush < 0 {
			writeError(http.StatusBadRequest, "expecting flush between 0-100")
			return
		}
	}

	speed := time.Millisecond * 10
	if query.Has("speed") {
		speed, err = time.ParseDuration(query.Get("speed"))
		if err != nil {
			writeError(http.StatusBadRequest, "invalid speed")
			return
		}
	}

	line := func(i int) string {
		return fmt.Sprintf("Message #%d", i)
	}
	switch query.Get("format") {
	case "json":
		line = func(i int) string {
			return fmt.Sprintf(`{"message": %d, "value": %.3f, "time": %d}`, i, rand.Float64(), time.Now().UnixMilli())
		}
	case "influx":
		line = func(i int) string {
			val := rand.Float64()
			return fmt.Sprintf("measurement,tag1=value1,tag2=value2 message=%d,value=%.3f %d", i, val, time.Now().UnixMilli())
		}
	}
	rw.WriteHeader(http.StatusOK)

	for i := start; i <= count; i++ {
		if _, err := io.WriteString(rw, line(i)+"\n"); err != nil {
			ctxLogger.Error("Failed to write response", "error", err)
			return
		}
		// This may send multiple lines in one chunk
		if flush > rand.Intn(100) {
			rw.(http.Flusher).Flush()
		}
		time.Sleep(speed)
	}
}

func createJSONHandler(logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctxLogger := logger.FromContext(req.Context())
		ctxLogger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		var reqData map[string]any
		if req.Body != nil {
			defer func() {
				if err := req.Body.Close(); err != nil {
					ctxLogger.Warn("Failed to close response body", "err", err)
				}
			}()
			b, err := io.ReadAll(req.Body)
			if err != nil {
				ctxLogger.Error("Failed to read request body to bytes", "error", err)
			} else {
				err := json.Unmarshal(b, &reqData)
				if err != nil {
					ctxLogger.Error("Failed to unmarshal request body to JSON", "error", err)
				}

				ctxLogger.Debug("Received resource call body", "body", reqData)
			}
		}

		data := map[string]any{
			"message": "Hello world from test datasource!",
			"request": map[string]any{
				"method":  req.Method,
				"url":     req.URL,
				"headers": req.Header,
				"body":    reqData,
			},
		}
		bytes, err := json.Marshal(&data)
		if err != nil {
			ctxLogger.Error("Failed to marshal response body to JSON", "error", err)
		}

		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
		if _, err := rw.Write(bytes); err != nil {
			ctxLogger.Error("Failed to write response", "error", err)
		}
	})
}

func (s *Service) testPanicHandler(rw http.ResponseWriter, req *http.Request) {
	panic("BOOM")
}
