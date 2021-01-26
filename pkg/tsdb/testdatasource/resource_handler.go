package testdatasource

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (p *testDataPlugin) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/", p.testGetHandler)
	mux.HandleFunc("/scenarios", p.getScenariosHandler)
	mux.HandleFunc("/stream", p.testStreamHandler)
	mux.Handle("/test", createJSONHandler(p.logger))
	mux.Handle("/test/json", createJSONHandler(p.logger))
	mux.HandleFunc("/boom", p.testPanicHandler)
}

func (p *testDataPlugin) testGetHandler(rw http.ResponseWriter, req *http.Request) {
	p.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	if req.Method != http.MethodGet {
		return
	}

	if _, err := rw.Write([]byte("Hello world from test datasource!")); err != nil {
		p.logger.Error("Failed to write response", "error", err)
		return
	}
	rw.WriteHeader(http.StatusOK)
}

func (p *testDataPlugin) getScenariosHandler(rw http.ResponseWriter, req *http.Request) {
	result := make([]interface{}, 0)

	scenarioIds := make([]string, 0)
	for id := range p.scenarios {
		scenarioIds = append(scenarioIds, id)
	}
	sort.Strings(scenarioIds)

	for _, scenarioID := range scenarioIds {
		scenario := p.scenarios[scenarioID]
		result = append(result, map[string]interface{}{
			"id":          scenario.ID,
			"name":        scenario.Name,
			"description": scenario.Description,
			"stringInput": scenario.StringInput,
		})
	}

	bytes, err := json.Marshal(&result)
	if err != nil {
		p.logger.Error("Failed to marshal response body to JSON", "error", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	if _, err := rw.Write(bytes); err != nil {
		p.logger.Error("Failed to write response", "error", err)
	}
}

func (p *testDataPlugin) testStreamHandler(rw http.ResponseWriter, req *http.Request) {
	p.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

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
			p.logger.Error("Failed to write response", "error", err)
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
			b, err := ioutil.ReadAll(req.Body)
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

		config := httpadapter.PluginConfigFromContext(req.Context())

		data := map[string]interface{}{
			"message": "Hello world from test datasource!",
			"request": map[string]interface{}{
				"method":  req.Method,
				"url":     req.URL,
				"headers": req.Header,
				"body":    reqData,
				"config":  config,
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

func (p *testDataPlugin) testPanicHandler(rw http.ResponseWriter, req *http.Request) {
	panic("BOOM")
}
