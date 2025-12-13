package opentsdb

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) HandleSuggestQuery(rw http.ResponseWriter, req *http.Request) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "api/suggest")
	u.RawQuery = req.URL.RawQuery
	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(responseBody); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}

func (s *Service) HandleAggregatorsQuery(rw http.ResponseWriter, req *http.Request) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "api/aggregators")
	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	var aggregators []string
	if err := json.Unmarshal(responseBody, &aggregators); err != nil {
		logger.Warn("Failed to unmarshal aggregators response, returning empty array", "error", err)
		aggregators = []string{}
	}

	sort.Strings(aggregators)
	sortedResponse, err := json.Marshal(aggregators)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(sortedResponse); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}

func (s *Service) HandleFiltersQuery(rw http.ResponseWriter, req *http.Request) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "/api/config/filters")
	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	var filters map[string]json.RawMessage
	if err := json.Unmarshal(responseBody, &filters); err != nil {
		logger.Warn("Failed to unmarshal filters response, returning empty array", "error", err)
		filters = make(map[string]json.RawMessage)
	}

	keys := make([]string, 0, len(filters))
	for key := range filters {
		keys = append(keys, key)
	}

	sort.Strings(keys)
	sortedResponse, err := json.Marshal(keys)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(sortedResponse); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}

func (s *Service) HandleLookupQuery(rw http.ResponseWriter, req *http.Request) {
	queryParams := req.URL.Query()
	typeParam := queryParams.Get("type")
	if typeParam == "" {
		http.Error(rw, "missing 'type' parameter", http.StatusBadRequest)
		return
	}

	switch typeParam {
	case "key":
		s.HandleKeyLookup(rw, req, queryParams)
	case "keyvalue":
		s.HandleKeyValueLookup(rw, req, queryParams)
	default:
		http.Error(rw, fmt.Sprintf("unsupported type: %s", typeParam), http.StatusBadRequest)
		return
	}
}

func (s *Service) HandleKeyLookup(rw http.ResponseWriter, req *http.Request, queryParams url.Values) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	metric := queryParams.Get("metric")
	if metric == "" {
		http.Error(rw, "missing 'metric' parameter", http.StatusBadRequest)
		return
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "api/search/lookup")
	lookupQueryParams := u.Query()
	lookupQueryParams.Set("m", metric)
	lookupQueryParams.Set("limit", "1000")
	u.RawQuery = lookupQueryParams.Encode()

	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	var lookupResponse struct {
		Results []struct {
			Tags map[string]string `json:"tags"`
		} `json:"results"`
	}

	if err := json.Unmarshal(responseBody, &lookupResponse); err != nil {
		http.Error(rw, fmt.Sprintf("failed to unmarshal lookup response: %v", err), http.StatusInternalServerError)
		return
	}

	tagKeysMap := make(map[string]bool)
	for _, result := range lookupResponse.Results {
		for tagKey := range result.Tags {
			tagKeysMap[tagKey] = true
		}
	}

	tagKeys := make([]string, 0, len(tagKeysMap))
	for tagKey := range tagKeysMap {
		tagKeys = append(tagKeys, tagKey)
	}

	sort.Strings(tagKeys)
	sortedResponse, err := json.Marshal(tagKeys)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(sortedResponse); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}

func (s *Service) HandleKeyValueLookup(rw http.ResponseWriter, req *http.Request, queryParams url.Values) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	metric := queryParams.Get("metric")
	if metric == "" {
		http.Error(rw, "missing 'metric' parameter", http.StatusBadRequest)
		return
	}

	keys := queryParams.Get("keys")
	if keys == "" {
		http.Error(rw, "missing 'keys' parameter", http.StatusBadRequest)
		return
	}

	keysArray := strings.Split(keys, ",")
	for i := range keysArray {
		keysArray[i] = strings.TrimSpace(keysArray[i])
	}

	if len(keysArray) == 0 {
		http.Error(rw, "keys parameter cannot be empty", http.StatusBadRequest)
		return
	}

	key := keysArray[0]
	keysQuery := key + "=*"

	if len(keysArray) > 1 {
		keysQuery += "," + strings.Join(keysArray[1:], ",")
	}

	m := metric + "{" + keysQuery + "}"

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "api/search/lookup")
	lookupQueryParams := u.Query()
	lookupQueryParams.Set("m", m)
	lookupQueryParams.Set("limit", fmt.Sprintf("%d", dsInfo.LookupLimit))
	u.RawQuery = lookupQueryParams.Encode()

	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	var lookupResponse struct {
		Results []struct {
			Tags map[string]string `json:"tags"`
		} `json:"results"`
	}

	if err := json.Unmarshal(responseBody, &lookupResponse); err != nil {
		http.Error(rw, fmt.Sprintf("failed to unmarshal lookup response: %v", err), http.StatusInternalServerError)
		return
	}

	tagValuesMap := make(map[string]bool)
	for _, result := range lookupResponse.Results {
		if tagValue, exists := result.Tags[key]; exists {
			tagValuesMap[tagValue] = true
		}
	}

	tagValues := make([]string, 0, len(tagValuesMap))
	for tagValue := range tagValuesMap {
		tagValues = append(tagValues, tagValue)
	}

	sort.Strings(tagValues)
	sortedResponse, err := json.Marshal(tagValues)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(sortedResponse); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}
