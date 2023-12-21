package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func TestIntegrationProvisioning(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a users to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "editor", "editor")
	// Create the namespace we'll save our alerts to.
	namespaceUID := "default"
	apiClient.CreateFolder(t, namespaceUID, namespaceUID)

	t.Run("when provisioning notification policies", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/policies", grafanaListedAddr)
		body := `
		{
			"receiver": "test-receiver",
			"group_by": [
				"..."
			],
			"routes": []
		}`

		// As we check if the receiver exists that is referenced in the policy,
		// we first need to create it, so the tests passes correctly.
		urlReceiver := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		bodyReceiver := `
		{
			"name": "test-receiver",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		req := createTestRequest("POST", urlReceiver, "admin", bodyReceiver)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 202, resp.StatusCode)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated PUT should 401", func(t *testing.T) {
			req := createTestRequest("PUT", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer PUT should 403", func(t *testing.T) {
			req := createTestRequest("PUT", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor PUT should 403", func(t *testing.T) {
			req := createTestRequest("PUT", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin PUT should succeed", func(t *testing.T) {
			req := createTestRequest("PUT", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		})
	})

	t.Run("when provisioning contactpoints", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		body := `
		{
			"name": "my-contact-point",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated POST should 401", func(t *testing.T) {
			req := createTestRequest("POST", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer POST should 403", func(t *testing.T) {
			req := createTestRequest("POST", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor POST should 403", func(t *testing.T) {
			req := createTestRequest("POST", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin POST should succeed", func(t *testing.T) {
			req := createTestRequest("POST", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 202, resp.StatusCode)
		})
	})

	t.Run("when provisioning templates", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/templates", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})

	t.Run("when provisioning mute timings", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/mute-timings", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})

	t.Run("when provisioning alert rules", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/alert-rules", grafanaListedAddr)
		body := `{"orgID":1,"folderUID":"default","ruleGroup":"Test Group","title":"Provisioned","condition":"A","data":[{"refId":"A","queryType":"","relativeTimeRange":{"from":600,"to":0},"datasourceUid":"f558c85f-66ad-4fd1-b31d-7979e6c93db4","model":{"editorMode":"code","exemplar":false,"expr":"sum(rate(low_card[5m])) \u003e 0","format":"time_series","instant":true,"intervalMs":1000,"legendFormat":"__auto","maxDataPoints":43200,"range":false,"refId":"A"}}],"noDataState":"NoData","execErrState":"Error","for":"0s"}`
		req := createTestRequest("POST", url, "admin", body)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 201, resp.StatusCode)

		// We want to check the provenances of both provisioned and non-provisioned rules
		createRule(t, apiClient, namespaceUID)

		req = createTestRequest("GET", url, "admin", "")
		resp, err = http.DefaultClient.Do(req)
		require.NoError(t, err)

		var rules definitions.ProvisionedAlertRules
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&rules))
		require.NoError(t, resp.Body.Close())

		require.Len(t, rules, 2)
		sort.Slice(rules, func(i, j int) bool {
			return rules[i].ID < rules[j].ID
		})
		require.Equal(t, definitions.Provenance("api"), rules[0].Provenance)
		require.Equal(t, definitions.Provenance(""), rules[1].Provenance)
	})
}

func TestMuteTimings(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	t.Run("default config should return empty list", func(t *testing.T) {
		mt, status, body := apiClient.GetAllMuteTimingsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Empty(t, mt)
	})

	emptyMuteTiming := definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name:          "Empty Mute Timing",
			TimeIntervals: []timeinterval.TimeInterval{},
		},
	}

	t.Run("should create a new mute timing without any intervals", func(t *testing.T) {
		mt, status, body := apiClient.CreateMuteTimingWithStatus(t, emptyMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
	})

	anotherMuteTiming := definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name: "Not Empty Mute Timing",
			TimeIntervals: []timeinterval.TimeInterval{
				{
					Times: []timeinterval.TimeRange{
						{
							StartMinute: 10,
							EndMinute:   45,
						},
					},
					Weekdays: []timeinterval.WeekdayRange{
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: 0,
								End:   2,
							},
						},
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: 4,
								End:   5,
							},
						},
					},
				},
			},
		},
	}

	t.Run("should create a new mute timing with some settings", func(t *testing.T) {
		mt, status, body := apiClient.CreateMuteTimingWithStatus(t, anotherMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
	})

	t.Run("should return mute timing by name", func(t *testing.T) {
		mt, status, body := apiClient.GetMuteTimingByNameWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, "", mt.Provenance) // TODO this is a bug

		mt, status, body = apiClient.GetMuteTimingByNameWithStatus(t, anotherMuteTiming.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, "", mt.Provenance) // TODO this is a bug
	})

	t.Run("should return NotFound if mute timing does not exist", func(t *testing.T) {
		_, status, body := apiClient.GetMuteTimingByNameWithStatus(t, "some-missing-timing")
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should return all mute timings", func(t *testing.T) {
		mt, status, body := apiClient.GetAllMuteTimingsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Len(t, mt, 2)

		slices.SortFunc(mt, func(a, b definitions.MuteTimeInterval) int {
			return strings.Compare(a.Name, b.Name)
		})

		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt[0].MuteTimeInterval)
		require.EqualValues(t, "", mt[0].Provenance) // TODO this is a bug

		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt[1].MuteTimeInterval)
		require.EqualValues(t, "", mt[1].Provenance) // TODO this is a bug
	})

	t.Run("should get BadRequest if creates a new mute timing with the same name", func(t *testing.T) {
		m := anotherMuteTiming
		m.TimeIntervals = nil
		_, status, body := apiClient.CreateMuteTimingWithStatus(t, m)
		t.Log(body)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError errutil.PublicError
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.NotEmpty(t, validationError, validationError.Message)
		assert.Equal(t, "alerting.notifications.mute-timings.nameExists", validationError.MessageID)
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should get BadRequest if creates an invalid mute timing", func(t *testing.T) {
		m := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "Invalid",
				TimeIntervals: []timeinterval.TimeInterval{
					{
						Times: []timeinterval.TimeRange{
							{
								StartMinute: 20000,
								EndMinute:   90000,
							},
						},
					},
				},
			},
		}
		_, status, body := apiClient.CreateMuteTimingWithStatus(t, m)
		t.Log(body)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError map[string]any
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.Contains(t, validationError, "message")
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should update existing mute timing", func(t *testing.T) {
		anotherMuteTiming.TimeIntervals = []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 36,
						EndMinute:   49,
					},
				},
			},
		}

		mt, status, body := apiClient.UpdateMuteTimingWithStatus(t, anotherMuteTiming)
		requireStatusCode(t, http.StatusAccepted, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
	})

	t.Run("should fail to update existing mute timing with invalid one", func(t *testing.T) {
		mt := anotherMuteTiming
		mt.TimeIntervals = []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 360000,
						EndMinute:   490000,
					},
				},
			},
		}

		_, status, body := apiClient.UpdateMuteTimingWithStatus(t, mt)

		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError map[string]any
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.Contains(t, validationError, "message")
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should get NotFound if updates mute timing that does not exist", func(t *testing.T) {
		mt := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "Missing Mute Timing",
			},
		}
		_, status, body := apiClient.UpdateMuteTimingWithStatus(t, mt)
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should delete unused mute timing", func(t *testing.T) {
		status, body := apiClient.DeleteMuteTimingWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusNoContent, status, body)

		_, status, body = apiClient.GetMuteTimingByNameWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should get BadRequest if deletes used mute-timing", func(t *testing.T) {
		route, status, response := apiClient.GetRouteWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, response)
		route.Routes = append(route.Routes, &definitions.Route{
			Receiver: route.Receiver,
			ObjectMatchers: definitions.ObjectMatchers{
				{
					Name:  "a",
					Value: "b",
				},
			},
			MuteTimeIntervals: []string{anotherMuteTiming.Name},
		})
		status, response = apiClient.UpdateRouteWithStatus(t, route)
		requireStatusCode(t, http.StatusAccepted, status, response)

		status, response = apiClient.DeleteMuteTimingWithStatus(t, anotherMuteTiming.Name)
		requireStatusCode(t, http.StatusInternalServerError, status, response) // TODO should be bad request
	})
}

func createTestRequest(method string, url string, user string, body string) *http.Request {
	var bodyBuf io.Reader
	if body != "" {
		bodyBuf = bytes.NewReader([]byte(body))
	}
	req, _ := http.NewRequest(method, url, bodyBuf)
	if bodyBuf != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if user != "" {
		req.SetBasicAuth(user, user)
	}
	return req
}
