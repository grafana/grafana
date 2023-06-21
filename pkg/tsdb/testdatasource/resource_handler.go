package testdatasource

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
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
	s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	if req.Method != http.MethodGet {
		return
	}

	if _, err := rw.Write([]byte("Hello world from test datasource!")); err != nil {
		s.logger.Error("Failed to write response", "error", err)
		return
	}
	rw.WriteHeader(http.StatusOK)
}

func (s *Service) getScenariosHandler(rw http.ResponseWriter, req *http.Request) {
	result := make([]interface{}, 0)

	scenarioIds := make([]string, 0)
	for id := range s.scenarios {
		scenarioIds = append(scenarioIds, id)
	}
	sort.Strings(scenarioIds)

	for _, scenarioID := range scenarioIds {
		scenario := s.scenarios[scenarioID]
		result = append(result, map[string]interface{}{
			"id":          scenario.ID,
			"name":        scenario.Name,
			"description": scenario.Description,
			"stringInput": scenario.StringInput,
		})
	}

	bytes, err := json.Marshal(&result)
	if err != nil {
		s.logger.Error("Failed to marshal response body to JSON", "error", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	if _, err := rw.Write(bytes); err != nil {
		s.logger.Error("Failed to write response", "error", err)
	}
}

func (s *Service) testStreamHandler(rw http.ResponseWriter, req *http.Request) {
	s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	if req.Method != http.MethodGet {
		return
	}

	count := 10
	countstr := req.URL.Query().Get("count")
	if countstr != "" {
		if i, err := strconv.Atoi(countstr); err == nil {
			count = i
		}
	}

	sleep := req.URL.Query().Get("sleep")
	sleepDuration, err := time.ParseDuration(sleep)
	if err != nil {
		sleepDuration = time.Millisecond
	}

	rw.Header().Set("Content-Type", "text/plain")
	rw.WriteHeader(http.StatusOK)

	for i := 1; i <= count; i++ {
		if _, err := io.WriteString(rw, fmt.Sprintf("Message #%d", i)); err != nil {
			s.logger.Error("Failed to write response", "error", err)
			return
		}
		rw.(http.Flusher).Flush()
		time.Sleep(sleepDuration)
	}
}

func createJSONHandler(logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		var reqData map[string]interface{}
		if req.Body != nil {
			defer func() {
				if err := req.Body.Close(); err != nil {
					logger.Warn("Failed to close response body", "err", err)
				}
			}()
			b, err := io.ReadAll(req.Body)
			if err != nil {
				logger.Error("Failed to read request body to bytes", "error", err)
			} else {
				err := json.Unmarshal(b, &reqData)
				if err != nil {
					logger.Error("Failed to unmarshal request body to JSON", "error", err)
				}

				logger.Debug("Received resource call body", "body", reqData)
			}
		}

		data := map[string]interface{}{
			"message": "Hello world from test datasource!",
			"request": map[string]interface{}{
				"method":  req.Method,
				"url":     req.URL,
				"headers": req.Header,
				"body":    reqData,
			},
		}
		bytes, err := json.Marshal(&data)
		if err != nil {
			logger.Error("Failed to marshal response body to JSON", "error", err)
		}

		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
		if _, err := rw.Write(bytes); err != nil {
			logger.Error("Failed to write response", "error", err)
		}
	})
}

func (s *Service) testPanicHandler(rw http.ResponseWriter, req *http.Request) {
	panic("BOOM")
}
