// LOGZ.IO GRAFANA CHANGE :: DEV-43744 - add requestId in error message
package es

import (
	"encoding/json"
	"net/http"
	"time"
)

// ErrorResponse represents an error response
type ErrorResponse struct {
	ErrorCode string `json:"errorCode,omitempty"`
	Code      int    `json:"code,omitempty"`
	Message   string `json:"message"`
	RequestId string `json:"requestId"`
}

func (c *baseClientImpl) DecodeErrorResponse(res *http.Response) (*ErrorResponse, error) {
	defer res.Body.Close()

	start := time.Now()
	c.logger.Debug("Decoding error json response")
	var errorResponse ErrorResponse
	dec := json.NewDecoder(res.Body)
	err := dec.Decode(&errorResponse)
	if err != nil {
		return nil, err
	}
	elapsed := time.Since(start)
	c.logger.Debug("Decoded error json response", "took", elapsed)

	return &errorResponse, err
}

// LOGZ.IO GRAFANA CHANGE :: end
