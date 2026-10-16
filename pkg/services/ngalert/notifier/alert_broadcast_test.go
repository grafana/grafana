package notifier

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	alertingCluster "github.com/grafana/alerting/cluster"
	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBroadcastAlerts(t *testing.T) {
	testCases := []struct {
		name          string
		orgID         int64
		alerts        apimodels.PostableAlerts
		channelExists bool
		expected      *AlertBroadcastPayload
	}{
		{
			name:  "broadcasts alerts when channel exists",
			orgID: 1,
			alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test alert"}},
				},
			},
			channelExists: true,
			expected: &AlertBroadcastPayload{
				OrgID: 1,
				Alerts: apimodels.PostableAlerts{
					PostableAlerts: []amv2.PostableAlert{
						{Annotations: amv2.LabelSet{"summary": "test alert"}},
					},
				},
			},
		},
		{
			name:  "does not broadcast when channel is nil",
			orgID: 1,
			alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test alert"}},
				},
			},
			channelExists: false,
			expected:      nil,
		},
		{
			name:          "does not broadcast empty alerts",
			orgID:         1,
			alerts:        apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}},
			channelExists: true,
			expected:      nil,
		},
		{
			name:          "does not broadcast nil alerts",
			orgID:         1,
			alerts:        apimodels.PostableAlerts{},
			channelExists: true,
			expected:      nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockChannel := &MockBroadcastChannel{}

			moa := &MultiOrgAlertmanager{
				logger: log.NewNopLogger(),
			}

			if tc.channelExists {
				moa.alertsBroadcastChannel = mockChannel
			}

			moa.BroadcastAlerts(tc.orgID, tc.alerts)

			if tc.expected == nil {
				require.Empty(t, mockChannel.Broadcasts())
			} else {
				require.Len(t, mockChannel.Broadcasts(), 1)
				var decoded AlertBroadcastPayload
				err := json.Unmarshal(mockChannel.Broadcasts()[0], &decoded)
				require.NoError(t, err)
				require.Equal(t, *tc.expected, decoded)
			}
		})
	}
}

// positionPeer is a ClusterPeer whose position is fixed by the test. Only
// Position is called by the code under test.
type positionPeer struct {
	alertingNotify.ClusterPeer
	position int
}

func (p *positionPeer) Position() int { return p.position }

func gettableAlert(name string, endsAt *time.Time) *amv2.GettableAlert {
	fp := name
	a := &amv2.GettableAlert{
		Alert: amv2.Alert{
			Labels:       amv2.LabelSet{"alertname": name},
			GeneratorURL: strfmt.URI("http://grafana/alerting/" + name),
		},
		Annotations: amv2.LabelSet{"summary": name + " summary"},
		Fingerprint: &fp,
	}
	if endsAt != nil {
		ends := strfmt.DateTime(*endsAt)
		starts := strfmt.DateTime(endsAt.Add(-10 * time.Minute))
		a.EndsAt = &ends
		a.StartsAt = &starts
	}
	return a
}

func activeAlertmanagerMock(t *testing.T, alerts apimodels.GettableAlerts) *alertmanager_mock.AlertmanagerMock {
	t.Helper()
	am := alertmanager_mock.NewAlertmanagerMock(t)
	am.On("Ready").Return(true)
	am.On("GetAlerts", mock.Anything, true, true, true, mock.Anything, "").Return(alerts, nil)
	return am
}

func singleNodeEvaluationSettings() *setting.Cfg {
	return &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{HASingleNodeEvaluation: true}}
}

func decodeFullState(t *testing.T, data []byte) []AlertBroadcastPayload {
	t.Helper()
	var payloads []AlertBroadcastPayload
	require.NoError(t, json.Unmarshal(data, &payloads))
	return payloads
}

func TestAlertBroadcast_MarshalBinary(t *testing.T) {
	now := time.Now()
	in3m := now.Add(3 * time.Minute)
	in4m := now.Add(4 * time.Minute)
	ago := now.Add(-time.Minute)

	t.Run("returns nil without a multi org alertmanager", func(t *testing.T) {
		state := newAlertBroadcastState(log.NewNopLogger(), nil)
		data, err := state.MarshalBinary()
		require.NoError(t, err)
		require.Nil(t, data)
	})

	t.Run("returns nil when this peer is not the evaluator", func(t *testing.T) {
		am := alertmanager_mock.NewAlertmanagerMock(t)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 1},
			alertmanagers: map[int64]Alertmanager{1: am},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		data, err := state.MarshalBinary()
		require.NoError(t, err)
		require.Nil(t, data)
		am.AssertNotCalled(t, "GetAlerts", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("returns nil without single node evaluation", func(t *testing.T) {
		for name, settings := range map[string]*setting.Cfg{"nil settings": nil, "disabled": {}} {
			t.Run(name, func(t *testing.T) {
				am := alertmanager_mock.NewAlertmanagerMock(t)
				moa := &MultiOrgAlertmanager{
					logger:        log.NewNopLogger(),
					peer:          &positionPeer{position: 0},
					settings:      settings,
					alertmanagers: map[int64]Alertmanager{1: am},
				}
				state := newAlertBroadcastState(log.NewNopLogger(), moa)
				data, err := state.MarshalBinary()
				require.NoError(t, err)
				require.Nil(t, data)
				am.AssertNotCalled(t, "GetAlerts", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			})
		}
	})

	t.Run("returns nil without a peer", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: alertmanager_mock.NewAlertmanagerMock(t)},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		data, err := state.MarshalBinary()
		require.NoError(t, err)
		require.Nil(t, data)
	})

	t.Run("returns nil when no org has active alerts", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: activeAlertmanagerMock(t, apimodels.GettableAlerts{})},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		data, err := state.MarshalBinary()
		require.NoError(t, err)
		require.Nil(t, data)
	})

	t.Run("encodes active alerts of every org sorted by org id", func(t *testing.T) {
		am1 := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("a1", &in3m), gettableAlert("a2", &in4m)})
		am2 := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("b1", &in3m)})
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{2: am2, 1: am1},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		data, err := state.MarshalBinary()
		require.NoError(t, err)

		payloads := decodeFullState(t, data)
		require.Len(t, payloads, 2)
		require.Equal(t, int64(1), payloads[0].OrgID)
		require.Equal(t, int64(2), payloads[1].OrgID)
		require.Len(t, payloads[0].Alerts.PostableAlerts, 2)
		require.Len(t, payloads[1].Alerts.PostableAlerts, 1)

		got := payloads[0].Alerts.PostableAlerts[0]
		require.Equal(t, amv2.LabelSet{"alertname": "a1"}, got.Labels)
		require.Equal(t, amv2.LabelSet{"summary": "a1 summary"}, got.Annotations)
		require.Equal(t, strfmt.URI("http://grafana/alerting/a1"), got.GeneratorURL)
		require.WithinDuration(t, in3m, time.Time(got.EndsAt), time.Second)
		require.WithinDuration(t, in3m.Add(-10*time.Minute), time.Time(got.StartsAt), time.Second)
	})

	t.Run("counts the published alerts", func(t *testing.T) {
		am1 := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("a1", &in3m), gettableAlert("a2", &in4m)})
		am2 := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("b1", &in3m), gettableAlert("ended", &ago)})
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: am1, 2: am2},
			metrics:       metrics.NewNGAlert(prometheus.NewRegistry()).GetMultiOrgAlertmanagerMetrics(),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		_, err := state.MarshalBinary()
		require.NoError(t, err)
		_, err = state.MarshalBinary()
		require.NoError(t, err)

		require.Equal(t, float64(6), testutil.ToFloat64(moa.metrics.AlertBroadcastFullStateAlerts))
		require.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.AlertBroadcastFullStateSkipped))
	})

	t.Run("drops alerts that are not active", func(t *testing.T) {
		am := activeAlertmanagerMock(t, apimodels.GettableAlerts{
			gettableAlert("ended", &ago),
			gettableAlert("no-end", nil),
			gettableAlert("active", &in3m),
		})
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: am},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		data, err := state.MarshalBinary()
		require.NoError(t, err)

		payloads := decodeFullState(t, data)
		require.Len(t, payloads, 1)
		require.Len(t, payloads[0].Alerts.PostableAlerts, 1)
		require.Equal(t, amv2.LabelSet{"alertname": "active"}, payloads[0].Alerts.PostableAlerts[0].Labels)
	})

	t.Run("skips org whose alertmanager is not ready", func(t *testing.T) {
		notReady := alertmanager_mock.NewAlertmanagerMock(t)
		notReady.On("Ready").Return(false)
		ready := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("a1", &in3m)})
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: notReady, 2: ready},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		data, err := state.MarshalBinary()
		require.NoError(t, err)

		payloads := decodeFullState(t, data)
		require.Len(t, payloads, 1)
		require.Equal(t, int64(2), payloads[0].OrgID)
		notReady.AssertNotCalled(t, "GetAlerts", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("skips org whose GetAlerts fails", func(t *testing.T) {
		failing := alertmanager_mock.NewAlertmanagerMock(t)
		failing.On("Ready").Return(true)
		failing.On("GetAlerts", mock.Anything, true, true, true, mock.Anything, "").Return(apimodels.GettableAlerts(nil), errors.New("boom"))
		ready := activeAlertmanagerMock(t, apimodels.GettableAlerts{gettableAlert("a1", &in3m)})
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: failing, 2: ready},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		data, err := state.MarshalBinary()
		require.NoError(t, err)

		payloads := decodeFullState(t, data)
		require.Len(t, payloads, 1)
		require.Equal(t, int64(2), payloads[0].OrgID)
	})

	t.Run("roundtrips 2000 alerts into a peer", func(t *testing.T) {
		alerts := make(apimodels.GettableAlerts, 0, 2000)
		for i := 0; i < 2000; i++ {
			alerts = append(alerts, gettableAlert(fmt.Sprintf("alert-%04d", i), &in4m))
		}
		evaluator := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: activeAlertmanagerMock(t, alerts)},
		}
		data, err := newAlertBroadcastState(log.NewNopLogger(), evaluator).MarshalBinary()
		require.NoError(t, err)

		peerAM := alertmanager_mock.NewAlertmanagerMock(t)
		peerAM.On("Ready").Return(true)
		peerAM.On("PutAlerts", mock.Anything, mock.MatchedBy(func(got apimodels.PostableAlerts) bool {
			return len(got.PostableAlerts) == 2000 &&
				got.PostableAlerts[0].Labels["alertname"] == "alert-0000" &&
				got.PostableAlerts[1999].Labels["alertname"] == "alert-1999"
		})).Return(nil)
		peer := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 1},
			alertmanagers: map[int64]Alertmanager{1: peerAM},
		}

		require.NoError(t, newAlertBroadcastState(log.NewNopLogger(), peer).Merge(data))
		peerAM.AssertExpectations(t)
	})
}

func TestAlertBroadcast_Merge(t *testing.T) {
	t.Run("empty payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		err := state.Merge([]byte{})
		require.NoError(t, err)
	})

	t.Run("nil payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		err := state.Merge(nil)
		require.NoError(t, err)
	})

	t.Run("invalid JSON returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		err := state.Merge([]byte("not valid json"))
		require.NoError(t, err)
	})

	t.Run("empty alerts in payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID:  1,
			Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
	})

	t.Run("delivers alerts to alertmanager", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		mockAM.On("PutAlerts", mock.Anything, mock.MatchedBy(func(alerts apimodels.PostableAlerts) bool {
			if len(alerts.PostableAlerts) != 3 {
				return false
			}
			expected := []string{"alert 1", "alert 2", "alert 3"}
			for i, alert := range alerts.PostableAlerts {
				if alert.Annotations["summary"] != expected[i] {
					return false
				}
			}
			return true
		})).Return(nil)

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: mockAM},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID: 1,
			Alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "alert 1"}},
					{Annotations: amv2.LabelSet{"summary": "alert 2"}},
					{Annotations: amv2.LabelSet{"summary": "alert 3"}},
				},
			},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
		mockAM.AssertExpectations(t)
	})

	t.Run("skips when alertmanager not found", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID: 999,
			Alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test"}},
				},
			},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
	})

	t.Run("skips when alertmanager not ready", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(false)

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: mockAM},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID: 1,
			Alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test"}},
				},
			},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
		mockAM.AssertNotCalled(t, "PutAlerts", mock.Anything, mock.Anything)
	})

	t.Run("does not return error when PutAlerts fails", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		mockAM.On("PutAlerts", mock.Anything, mock.Anything).Return(errors.New("test error"))

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: mockAM},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID: 1,
			Alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test"}},
				},
			},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
		mockAM.AssertExpectations(t)
	})

	t.Run("full state delivers alerts to every org", func(t *testing.T) {
		am1 := alertmanager_mock.NewAlertmanagerMock(t)
		am1.On("Ready").Return(true)
		am1.On("PutAlerts", mock.Anything, mock.MatchedBy(func(a apimodels.PostableAlerts) bool {
			return len(a.PostableAlerts) == 2
		})).Return(nil)
		am2 := alertmanager_mock.NewAlertmanagerMock(t)
		am2.On("Ready").Return(true)
		am2.On("PutAlerts", mock.Anything, mock.MatchedBy(func(a apimodels.PostableAlerts) bool {
			return len(a.PostableAlerts) == 1
		})).Return(nil)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: am1, 2: am2},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal([]AlertBroadcastPayload{
			{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{
				{Annotations: amv2.LabelSet{"summary": "a1"}},
				{Annotations: amv2.LabelSet{"summary": "a2"}},
			}}},
			{OrgID: 2, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{
				{Annotations: amv2.LabelSet{"summary": "b1"}},
			}}},
		})
		require.NoError(t, err)

		require.NoError(t, state.Merge(payload))
		am1.AssertExpectations(t)
		am2.AssertExpectations(t)
	})

	t.Run("full state skips unknown org, delivers the rest", func(t *testing.T) {
		am := alertmanager_mock.NewAlertmanagerMock(t)
		am.On("Ready").Return(true)
		am.On("PutAlerts", mock.Anything, mock.Anything).Return(nil)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{2: am},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal([]AlertBroadcastPayload{
			{OrgID: 999, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "gone"}}}}},
			{OrgID: 2, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "b1"}}}}},
		})
		require.NoError(t, err)

		require.NoError(t, state.Merge(payload))
		am.AssertExpectations(t)
	})

	t.Run("full state skips empty orgs", func(t *testing.T) {
		am := alertmanager_mock.NewAlertmanagerMock(t)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: am},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		payload, err := json.Marshal([]AlertBroadcastPayload{
			{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}}},
		})
		require.NoError(t, err)

		require.NoError(t, state.Merge(payload))
		am.AssertNotCalled(t, "PutAlerts", mock.Anything, mock.Anything)
	})

	t.Run("malformed full state is ignored", func(t *testing.T) {
		am := alertmanager_mock.NewAlertmanagerMock(t)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: am},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)

		require.NoError(t, state.Merge([]byte(`[1, 2]`)))
		require.NoError(t, state.Merge([]byte(`  [`)))
		am.AssertNotCalled(t, "PutAlerts", mock.Anything, mock.Anything)
	})
}

func TestInitAlertBroadcast(t *testing.T) {
	testCases := []struct {
		name            string
		setupPeer       func() (alertingNotify.ClusterPeer, *MockBroadcastChannel)
		expectChannel   bool
		needsMetrics    bool
		customQueueSize int
	}{
		{
			name: "does not initialize when peer is nil",
			setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) {
				return nil, nil
			},
			expectChannel: false,
		},
		{
			name: "does not initialize when peer is NilPeer",
			setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) {
				return &NilPeer{}, nil
			},
			expectChannel: false,
		},
		{
			name: "initializes when peer is not NilPeer",
			setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) {
				ch := &MockBroadcastChannel{}
				return &MockClusterPeer{Channel: ch}, ch
			},
			expectChannel: true,
			needsMetrics:  true,
		},
		{
			name: "passes reliable delivery and queue size options",
			setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) {
				ch := &MockBroadcastChannel{}
				return &MockClusterPeer{Channel: ch}, ch
			},
			expectChannel: true,
			needsMetrics:  true,
		},
		{
			name: "passes custom queue size from config",
			setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) {
				ch := &MockBroadcastChannel{}
				return &MockClusterPeer{Channel: ch}, ch
			},
			expectChannel:   true,
			needsMetrics:    true,
			customQueueSize: 500,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			peer, expectedChannel := tc.setupPeer()
			moa := &MultiOrgAlertmanager{
				logger: log.NewNopLogger(),
				peer:   peer,
			}
			if tc.needsMetrics {
				queueSize := tc.customQueueSize
				if queueSize == 0 {
					queueSize = 200
				}
				reg := prometheus.NewRegistry()
				m := metrics.NewNGAlert(reg)
				moa.metrics = m.GetMultiOrgAlertmanagerMetrics()
				moa.settings = &setting.Cfg{
					UnifiedAlerting: setting.UnifiedAlertingSettings{
						HASingleEvaluationAlertBroadcastQueueSize: queueSize,
					},
				}
			}

			moa.initAlertBroadcast()

			if tc.expectChannel {
				require.NotNil(t, moa.alertsBroadcastChannel)
				require.Equal(t, expectedChannel, moa.alertsBroadcastChannel)
			} else {
				require.Nil(t, moa.alertsBroadcastChannel)
			}

			if mockPeer, ok := peer.(*MockClusterPeer); ok {
				require.Len(t, mockPeer.LastOptions, 2, "expected WithReliableDelivery and WithQueueSize options")
				resolved := alertingCluster.ResolveOptions(mockPeer.LastOptions...)
				require.True(t, resolved.ReliableDelivery)
				expectedQueueSize := tc.customQueueSize
				if expectedQueueSize == 0 {
					expectedQueueSize = 200
				}
				require.Equal(t, expectedQueueSize, resolved.QueueSize)
			}
		})
	}
}

// memberlist calls MarshalBinary and Merge of the full state with the cluster
// peer lock held for reading. SyncAlertmanagersForOrgs holds alertmanagersMtx
// for writing while it creates an org Alertmanager, which registers states and
// needs the peer lock for writing. Waiting for alertmanagersMtx in the full
// state path would therefore deadlock, so it must skip the round instead.
func TestAlertBroadcast_FullStateDoesNotWaitForAlertmanagersLock(t *testing.T) {
	returnsWithinTimeout := func(t *testing.T, f func()) {
		t.Helper()
		done := make(chan struct{})
		go func() {
			defer close(done)
			f()
		}()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			require.Fail(t, "blocked while alertmanagersMtx is held for writing")
		}
	}

	tolerantAlertmanager := func(t *testing.T) *alertmanager_mock.AlertmanagerMock {
		t.Helper()
		am := alertmanager_mock.NewAlertmanagerMock(t)
		am.On("Ready").Return(true).Maybe()
		am.On("GetAlerts", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(apimodels.GettableAlerts{}, nil).Maybe()
		am.On("PutAlerts", mock.Anything, mock.Anything).Return(nil).Maybe()
		return am
	}

	t.Run("MarshalBinary skips the round", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 0},
			settings:      singleNodeEvaluationSettings(),
			alertmanagers: map[int64]Alertmanager{1: tolerantAlertmanager(t)},
			metrics:       metrics.NewNGAlert(prometheus.NewRegistry()).GetMultiOrgAlertmanagerMetrics(),
		}
		moa.alertmanagersMtx.Lock()
		defer moa.alertmanagersMtx.Unlock()

		returnsWithinTimeout(t, func() {
			data, err := newAlertBroadcastState(log.NewNopLogger(), moa).MarshalBinary()
			require.NoError(t, err)
			require.Nil(t, data)
		})
		require.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.AlertBroadcastFullStateSkipped))
		require.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.AlertBroadcastFullStateAlerts))
	})

	t.Run("Merge of a full state skips the round", func(t *testing.T) {
		am := tolerantAlertmanager(t)
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			peer:          &positionPeer{position: 1},
			alertmanagers: map[int64]Alertmanager{1: am},
		}
		payload, err := json.Marshal([]AlertBroadcastPayload{
			{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "a1"}}}}},
		})
		require.NoError(t, err)
		moa.alertmanagersMtx.Lock()
		defer moa.alertmanagersMtx.Unlock()

		returnsWithinTimeout(t, func() {
			require.NoError(t, newAlertBroadcastState(log.NewNopLogger(), moa).Merge(payload))
		})
		am.AssertNotCalled(t, "PutAlerts", mock.Anything, mock.Anything)
	})
}
