package api

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"io"
	"net/http"
)

func (hs *HTTPServer) GetSlackChannels(c *contextmodel.ReqContext) response.Response {
	req, err := http.NewRequest(http.MethodPost, "https://slack.com/api/conversations.list", nil)
	req.Header.Add("Content-Type", "application/json; charset=utf-8")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", hs.Cfg.SlackToken))

	if err != nil {
		fmt.Errorf("client: could not create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Errorf("client: error making http request: %w", err)
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Errorf("client: could not read response body: %w", err)
	}

	var result dtos.SlackChannels
	err = json.Unmarshal(b, &result)
	if err != nil {
		fmt.Errorf("client: could not unmarshall response: %w", err)
	}

	return response.JSON(http.StatusOK, result.Channels)
}
