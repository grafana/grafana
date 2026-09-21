package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	authlib "github.com/grafana/authlib/types"
	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/errortracking/pkg/apis/errortracking/v0alpha1"
)

const (
	maxRequestBodyBytes = 64 << 10
	maxProjectLength    = 255
	maxMessageLength    = 16 << 10
	defaultListLimit    = 100
	maxListLimit        = 500
	maxDateWindow       = 31 * 24 * time.Hour
)

var errRequestBodyTooLarge = errors.New("request body too large")

func writeError(w sdkapp.CustomRouteResponseWriter, status int, code, msg string) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(map[string]string{"error": msg, "code": code})
}

func writeJSON(w sdkapp.CustomRouteResponseWriter, value any) error {
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(value)
}

// sourceIPFromHeaders makes a best effort to find the caller's IP from proxy headers.
// app.CustomRouteRequest doesn't expose the raw connection's RemoteAddr (see
// the App SDK) - a direct local curl with no reverse proxy in front will
// have neither header, and this returns "unknown".
func sourceIPFromHeaders(headers http.Header) string {
	if fwd := headers.Get("X-Forwarded-For"); fwd != "" {
		first, _, _ := strings.Cut(fwd, ",")
		return strings.TrimSpace(first)
	}
	if real := headers.Get("X-Real-Ip"); real != "" {
		return real
	}
	return "unknown"
}

func timeRange(query url.Values) (time.Time, time.Time, int, error) {
	to := time.Now()
	from := to.Add(-time.Hour)
	if value := query.Get("from"); value != "" {
		ms, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return time.Time{}, time.Time{}, 0, fmt.Errorf("invalid from")
		}
		from = time.UnixMilli(ms)
	}
	if value := query.Get("to"); value != "" {
		ms, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return time.Time{}, time.Time{}, 0, fmt.Errorf("invalid to")
		}
		to = time.UnixMilli(ms)
	}
	if from.After(to) || to.Sub(from) > maxDateWindow {
		return time.Time{}, time.Time{}, 0, fmt.Errorf("invalid time range")
	}
	limit := defaultListLimit
	if value := query.Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > maxListLimit {
			return time.Time{}, time.Time{}, 0, fmt.Errorf("invalid limit")
		}
		limit = parsed
	}
	return from, to, limit, nil
}

func decodeJSONBody(body io.Reader, value any) error {
	payload, err := io.ReadAll(io.LimitReader(body, maxRequestBodyBytes+1))
	if err != nil {
		return err
	}
	if len(payload) > maxRequestBodyBytes {
		return errRequestBodyTooLarge
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return fmt.Errorf("request contains more than one JSON value")
	}
	return nil
}

func field(value string, maxLength int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > maxLength {
		return "", fmt.Errorf("field is empty or too long")
	}
	return value, nil
}

func createEventHandler(store Store) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, r *sdkapp.CustomRouteRequest) error {
		user, err := trustedTenant(ctx)
		if err != nil {
			return writeError(w, http.StatusUnauthorized, "auth_error", "authentication required")
		}
		var body v0alpha1.CreateEventRequestBody
		if err := decodeJSONBody(r.Body, &body); err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, errRequestBodyTooLarge) {
				status = http.StatusRequestEntityTooLarge
			}
			return writeError(w, status, "bad_request", "invalid JSON body")
		}
		project, projectErr := field(body.Project, maxProjectLength)
		message, messageErr := field(body.Message, maxMessageLength)
		if projectErr != nil || messageErr != nil {
			return writeError(w, http.StatusBadRequest, "bad_request", "project and message are required")
		}
		occurredAt := time.Now().UnixMilli()
		if body.OccurredAt != nil {
			occurredAt = *body.OccurredAt
			if occurredAt < time.Now().Add(-maxDateWindow).UnixMilli() || occurredAt > time.Now().Add(5*time.Minute).UnixMilli() {
				return writeError(w, http.StatusBadRequest, "bad_request", "occurredAt is outside the allowed time window")
			}
		}
		if err := store.InsertEvent(ctx, tenantKey(user), user.GetUID(), sourceIPFromHeaders(r.Headers), project, message, occurredAt); err != nil {
			return writeError(w, http.StatusInternalServerError, "internal_error", "failed to store event")
		}
		return writeJSON(w, v0alpha1.CreateEventResponse{CreateEventBody: v0alpha1.CreateEventBody{Status: "ok"}})
	}
}

func listEventsHandler(store Store) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, r *sdkapp.CustomRouteRequest) error {
		user, err := trustedTenant(ctx)
		if err != nil {
			return writeError(w, http.StatusUnauthorized, "auth_error", "authentication required")
		}
		from, to, limit, err := timeRange(r.URL.Query())
		if err != nil {
			return writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		}
		events, err := store.ListEvents(ctx, tenantKey(user), from, to, limit)
		if err != nil {
			return writeError(w, http.StatusInternalServerError, "internal_error", "failed to list events")
		}
		items := make([]v0alpha1.ListEventsV0alpha1BodyItems, 0, len(events))
		for _, event := range events {
			items = append(items, v0alpha1.ListEventsV0alpha1BodyItems{OccurredAt: event.OccurredAt, Project: event.Project, Message: event.Message, CreatedBy: event.CreatedBy})
		}
		return writeJSON(w, v0alpha1.ListEventsResponse{ListEventsBody: v0alpha1.ListEventsBody{Items: items}})
	}
}

func tenantKey(user authlib.AuthInfo) string {
	if user.GetNamespace() == "default" {
		return "org-1"
	}
	return user.GetNamespace()
}

func trustedTenant(ctx context.Context) (authlib.AuthInfo, error) {
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok || user == nil || user.GetIdentityType() == authlib.TypeAnonymous || user.GetNamespace() == "" || user.GetNamespace() == "*" {
		return nil, fmt.Errorf("authenticated tenant identity required")
	}
	if _, err := authlib.ParseNamespace(user.GetNamespace()); err != nil {
		return nil, fmt.Errorf("invalid tenant namespace: %w", err)
	}
	return user, nil
}
