package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/colorshapes/pkg/apis/colorshapes/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func writeError(w sdkapp.CustomRouteResponseWriter, status int, code, msg string) error {
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(map[string]string{"error": msg, "code": code})
}

// sourceIPFromHeaders makes a best effort to find the caller's IP from proxy headers.
// app.CustomRouteRequest doesn't expose the raw connection's RemoteAddr (see
// apps/colorshapes/plan.md) - a direct local curl with no reverse proxy in front will
// have neither header, and this returns "unknown".
func sourceIPFromHeaders(headers http.Header) string {
	if fwd := headers.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	if real := headers.Get("X-Real-Ip"); real != "" {
		return real
	}
	return "unknown"
}

func createHitHandler(store Store) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, r *sdkapp.CustomRouteRequest) error {
		user, err := identity.GetRequester(ctx)
		if err != nil {
			return writeError(w, http.StatusUnauthorized, "auth_error", "authentication required")
		}

		var body v0alpha1.CreateHitRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			return writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		}
		if strings.TrimSpace(body.Color) == "" || strings.TrimSpace(body.Shape) == "" {
			return writeError(w, http.StatusBadRequest, "bad_request", "color and shape are required")
		}

		sourceIP := sourceIPFromHeaders(r.Headers)
		if err := store.Insert(ctx, user.GetUID(), sourceIP, body.Color, body.Shape); err != nil {
			return writeError(w, http.StatusInternalServerError, "internal_error", "failed to store hit")
		}

		return json.NewEncoder(w).Encode(v0alpha1.CreateHitResponse{
			CreateHitBody: v0alpha1.CreateHitBody{Status: "ok"},
		})
	}
}

func listHitsHandler(store Store) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, r *sdkapp.CustomRouteRequest) error {
		if _, err := identity.GetRequester(ctx); err != nil {
			return writeError(w, http.StatusUnauthorized, "auth_error", "authentication required")
		}

		to := time.Now()
		from := to.Add(-time.Hour)
		if v := r.URL.Query().Get("from"); v != "" {
			if ms, err := strconv.ParseInt(v, 10, 64); err == nil {
				from = time.UnixMilli(ms)
			}
		}
		if v := r.URL.Query().Get("to"); v != "" {
			if ms, err := strconv.ParseInt(v, 10, 64); err == nil {
				to = time.UnixMilli(ms)
			}
		}

		hits, err := store.List(ctx, from, to)
		if err != nil {
			return writeError(w, http.StatusInternalServerError, "internal_error", "failed to list hits")
		}

		items := make([]v0alpha1.ListHitsV0alpha1BodyItems, 0, len(hits))
		for _, h := range hits {
			items = append(items, v0alpha1.ListHitsV0alpha1BodyItems{
				CreatedAt: h.CreatedAt,
				SourceIp:  h.SourceIP,
				Color:     h.Color,
				Shape:     h.Shape,
				CreatedBy: h.CreatedBy,
			})
		}

		return json.NewEncoder(w).Encode(v0alpha1.ListHitsResponse{
			ListHitsBody: v0alpha1.ListHitsBody{Items: items},
		})
	}
}

func listEventsHandler(store Store) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, r *sdkapp.CustomRouteRequest) error {
		if _, err := identity.GetRequester(ctx); err != nil {
			return writeError(w, http.StatusUnauthorized, "auth_error", "authentication required")
		}
		to := time.Now()
		from := to.Add(-time.Hour)
		if v := r.URL.Query().Get("from"); v != "" {
			if ms, err := strconv.ParseInt(v, 10, 64); err == nil {
				from = time.UnixMilli(ms)
			}
		}
		if v := r.URL.Query().Get("to"); v != "" {
			if ms, err := strconv.ParseInt(v, 10, 64); err == nil {
				to = time.UnixMilli(ms)
			}
		}
		events, err := store.ListEvents(ctx, from, to)
		if err != nil {
			return writeError(w, http.StatusInternalServerError, "internal_error", "failed to list events")
		}
		items := make([]v0alpha1.ListEventsV0alpha1BodyItems, 0, len(events))
		for _, event := range events {
			items = append(items, v0alpha1.ListEventsV0alpha1BodyItems{EventId: event.EventID, ProjectId: event.ProjectID, Message: event.Message, OccurredAt: event.OccurredAt})
		}
		return json.NewEncoder(w).Encode(v0alpha1.ListEventsResponse{ListEventsBody: v0alpha1.ListEventsBody{Items: items}})
	}
}
