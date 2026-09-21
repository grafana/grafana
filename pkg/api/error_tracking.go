package api

import (
	"bytes"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/colorshapes"
	"github.com/grafana/grafana/pkg/web"
)

const maxEnvelopeSize = 1 << 20

type envelopeEvent struct {
	EventID string
	Message string
	Raw     string
}

func envelopeLine(data []byte) (string, []byte, error) {
	i := bytes.IndexByte(data, '\n')
	if i < 0 {
		return "", nil, fmt.Errorf("missing envelope line")
	}
	return strings.TrimSuffix(string(data[:i]), "\r"), data[i+1:], nil
}

func parseEnvelope(data []byte) (envelopeEvent, error) {
	if len(data) == 0 || len(data) > maxEnvelopeSize {
		return envelopeEvent{}, fmt.Errorf("invalid envelope size")
	}
	headerLine, data, err := envelopeLine(data)
	if err != nil {
		return envelopeEvent{}, err
	}
	var envelopeHeader struct {
		EventID string `json:"event_id"`
	}
	if err := json.Unmarshal([]byte(headerLine), &envelopeHeader); err != nil {
		return envelopeEvent{}, fmt.Errorf("invalid envelope header")
	}
	for len(data) > 0 {
		itemHeaderLine, rest, err := envelopeLine(data)
		if err != nil {
			return envelopeEvent{}, err
		}
		var itemHeader struct {
			Type   string `json:"type"`
			Length *int   `json:"length"`
		}
		if err := json.Unmarshal([]byte(itemHeaderLine), &itemHeader); err != nil || itemHeader.Type == "" || (itemHeader.Length != nil && *itemHeader.Length < 0) {
			return envelopeEvent{}, fmt.Errorf("invalid item header")
		}
		data = rest
		var payload []byte
		if itemHeader.Length != nil {
			if len(data) < *itemHeader.Length {
				return envelopeEvent{}, fmt.Errorf("short item payload")
			}
			payload, data = data[:*itemHeader.Length], data[*itemHeader.Length:]
			if len(data) > 0 {
				if data[0] != '\n' {
					return envelopeEvent{}, fmt.Errorf("missing item separator")
				}
				data = data[1:]
			}
		} else {
			line, next, err := envelopeLine(data)
			if err != nil {
				payload, data = data, nil
			} else {
				payload, data = []byte(line), next
			}
		}
		if itemHeader.Type != "event" {
			continue
		}
		var event struct {
			EventID   string `json:"event_id"`
			Message   string `json:"message"`
			Exception struct {
				Values []struct {
					Type  string `json:"type"`
					Value string `json:"value"`
				} `json:"values"`
			} `json:"exception"`
		}
		if err := json.Unmarshal(payload, &event); err != nil {
			return envelopeEvent{}, fmt.Errorf("invalid event payload")
		}
		message := strings.TrimSpace(event.Message)
		if message == "" && len(event.Exception.Values) > 0 {
			message = strings.TrimSpace(strings.TrimSpace(event.Exception.Values[0].Type + ": " + event.Exception.Values[0].Value))
		}
		if message == "" {
			message = "Captured error"
		}
		if event.EventID == "" {
			event.EventID = envelopeHeader.EventID
		}
		return envelopeEvent{EventID: event.EventID, Message: message, Raw: string(payload)}, nil
	}
	return envelopeEvent{}, fmt.Errorf("envelope has no event")
}

func validEventID(id string) bool {
	if len(id) != 32 {
		return false
	}
	_, err := hex.DecodeString(id)
	return err == nil
}

func configuredIngestionKey(cfg *setting.Cfg) string {
	return strings.TrimSpace(cfg.SectionWithEnvOverrides("error_tracking").Key("project_key").String())
}

func authorizedEnvelope(c *contextmodel.ReqContext, configured string) bool {
	if configured == "" {
		return false
	}
	value := sentryAuthKey(c.Req.Header.Get("X-Sentry-Auth"))
	return len(value) == len(configured) && subtle.ConstantTimeCompare([]byte(value), []byte(configured)) == 1
}

func sentryAuthKey(header string) string {
	value := strings.TrimSpace(header)
	if !strings.HasPrefix(value, "Sentry ") {
		return ""
	}
	parts := strings.TrimPrefix(value, "Sentry ")
	value = ""
	for _, part := range strings.Split(parts, ",") {
		key, valuePart, found := strings.Cut(strings.TrimSpace(part), "=")
		if found && key == "sentry_key" {
			value = strings.Trim(valuePart, " \"")
		}
	}
	return value
}

func (hs *HTTPServer) PostErrorEnvelope(c *contextmodel.ReqContext) response.Response {
	projectID := web.Params(c.Req)[":project_id"]
	configuredProject := strings.TrimSpace(hs.Cfg.SectionWithEnvOverrides("error_tracking").Key("project_id").MustString("1"))
	if projectID == "" || projectID != configuredProject || !authorizedEnvelope(c, configuredIngestionKey(hs.Cfg)) {
		return response.Error(http.StatusUnauthorized, "Unauthorized", fmt.Errorf("invalid project credentials"))
	}
	body, err := io.ReadAll(io.LimitReader(c.Req.Body, maxEnvelopeSize+1))
	if err != nil || len(body) > maxEnvelopeSize {
		return response.Error(http.StatusRequestEntityTooLarge, "Invalid envelope", fmt.Errorf("envelope too large"))
	}
	event, err := parseEnvelope(body)
	if err != nil || !validEventID(event.EventID) {
		return response.Error(http.StatusBadRequest, "Invalid envelope", fmt.Errorf("event payload is invalid"))
	}
	inserted, err := colorshapes.ProvideStore(hs.SQLStore).InsertEvent(c.Req.Context(), event.EventID, projectID, event.Message, event.Raw, time.Now().UnixMilli())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to store event", err)
	}
	return response.JSON(http.StatusOK, map[string]any{"id": event.EventID, "duplicate": !inserted})
}
