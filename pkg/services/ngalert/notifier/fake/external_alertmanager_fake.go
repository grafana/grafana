package fake

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/go-openapi/strfmt"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

type FakeExternalAlertmanager struct {
	t        *testing.T
	mtx      sync.RWMutex
	tenantID string
	password string
	Server   *httptest.Server

	silences alertingNotify.GettableSilences
}

func NewFakeExternalAlertmanager(t *testing.T, tenantID, password string) *FakeExternalAlertmanager {
	t.Helper()
	am := &FakeExternalAlertmanager{
		t:        t,
		tenantID: tenantID,
		password: password,
		mtx:      sync.RWMutex{},
	}
	mux := web.New()
	mux.SetURLPrefix("/alertmanager/api/")
	mux.UseMiddleware(am.basicAuthMiddleware)
	mux.UseMiddleware(am.contentTypeJSONMiddleware)

	// Routes
	mux.Get("/v2/silences", http.HandlerFunc(am.getSilences))
	mux.Get("/v2/silence/:silenceID", http.HandlerFunc(am.getSilence))
	mux.Post("/v2/silences", http.HandlerFunc(am.postSilence))
	mux.Delete("/v2/silence/:silenceID", http.HandlerFunc(am.deleteSilence))

	am.Server = httptest.NewServer(mux)
	return am
}

func (am *FakeExternalAlertmanager) getSilences(w http.ResponseWriter, r *http.Request) {
	am.mtx.RLock()
	if err := json.NewEncoder(w).Encode(am.silences); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	}
	am.mtx.RUnlock()
}

func (am *FakeExternalAlertmanager) getSilence(w http.ResponseWriter, r *http.Request) {
	silenceID, ok := web.Params(r)[":silenceID"]
	if !ok {
		return
	}

	am.mtx.RLock()
	var matching *alertingNotify.GettableSilence
	for _, silence := range am.silences {
		if *silence.ID == silenceID {
			matching = silence
			break
		}
	}
	am.mtx.RUnlock()

	if matching == nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if err := json.NewEncoder(w).Encode(matching); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	}
}

func (am *FakeExternalAlertmanager) postSilence(w http.ResponseWriter, r *http.Request) {
	var silence definitions.PostableSilence
	require.NoError(am.t, json.NewDecoder(r.Body).Decode(&silence))

	updatedAt := strfmt.NewDateTime()
	id := util.GenerateShortUID()

	am.mtx.Lock()
	am.silences = append(am.silences, &alertingNotify.GettableSilence{
		ID:        &id,
		UpdatedAt: &updatedAt,
		Silence:   silence.Silence,
	})
	am.mtx.Unlock()

	res := map[string]string{"silenceID": id}
	if err := json.NewEncoder(w).Encode(res); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	}
}

func (am *FakeExternalAlertmanager) deleteSilence(w http.ResponseWriter, r *http.Request) {
	silenceID, ok := web.Params(r)[":silenceID"]
	if !ok {
		return
	}

	am.mtx.Lock()
	defer am.mtx.Unlock()
	var newSilences []*alertingNotify.GettableSilence
	for _, silence := range am.silences {
		if *silence.ID != silenceID {
			newSilences = append(newSilences, silence)
		}
	}

	if len(newSilences) == len(am.silences) {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	am.silences = newSilences
	w.WriteHeader(http.StatusOK)
}

func (am *FakeExternalAlertmanager) basicAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username, password, ok := r.BasicAuth()
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if username != am.tenantID || password != am.password || r.Header.Get("X-Scope-OrgID") != am.tenantID {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (am *FakeExternalAlertmanager) contentTypeJSONMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

func (am *FakeExternalAlertmanager) Close() {
	am.Server.Close()
}
