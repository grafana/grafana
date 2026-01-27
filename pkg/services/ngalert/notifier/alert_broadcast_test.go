package notifier

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
)

func TestBroadcastAlerts(t *testing.T) {
	testCases := []struct {
		name               string
		orgID              int64
		alerts             apimodels.PostableAlerts
		channelExists      bool
		expected           *AlertBroadcastPayload
		expectedAlertsSent int
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
			expectedAlertsSent: 1,
		},
		{
			name:  "does not broadcast when channel is nil",
			orgID: 1,
			alerts: apimodels.PostableAlerts{
				PostableAlerts: []amv2.PostableAlert{
					{Annotations: amv2.LabelSet{"summary": "test alert"}},
				},
			},
			channelExists:      false,
			expected:           nil,
			expectedAlertsSent: 0,
		},
		{
			name:               "does not broadcast empty alerts",
			orgID:              1,
			alerts:             apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}},
			channelExists:      true,
			expected:           nil,
			expectedAlertsSent: 0,
		},
		{
			name:               "does not broadcast nil alerts",
			orgID:              1,
			alerts:             apimodels.PostableAlerts{},
			channelExists:      true,
			expected:           nil,
			expectedAlertsSent: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockChannel := &MockBroadcastChannel{}
			reg := prometheus.NewRegistry()
			m := metrics.NewNGAlert(reg)

			moa := &MultiOrgAlertmanager{
				logger:  log.NewNopLogger(),
				metrics: m.GetMultiOrgAlertmanagerMetrics(),
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

			// Verify metrics
			alertsSent := int(testGetCounterValue(t, reg, "grafana_alerting_alert_broadcast_alerts_sent_total"))
			require.Equal(t, tc.expectedAlertsSent, alertsSent)
		})
	}
}

func TestAlertBroadcast_MarshalBinary(t *testing.T) {
	state := newAlertBroadcastState(log.NewNopLogger(), nil, nil)

	data, err := state.MarshalBinary()

	require.NoError(t, err)
	require.Nil(t, data, "MarshalBinary should return nil for alert broadcast state (no full state sync)")
}

func TestAlertBroadcast_Merge(t *testing.T) {
	t.Run("empty payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, nil)

		err := state.Merge([]byte{})
		require.NoError(t, err)
	})

	t.Run("nil payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, nil)

		err := state.Merge(nil)
		require.NoError(t, err)
	})

	t.Run("invalid JSON increments error metric", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := metrics.NewNGAlert(reg)

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, m.GetMultiOrgAlertmanagerMetrics())

		err := state.Merge([]byte("not valid json"))
		require.NoError(t, err)

		require.Equal(t, 1, int(testGetCounterValueWithLabel(t, reg, "grafana_alerting_alert_broadcast_receive_errors_total", "reason", "unmarshal")))
	})

	t.Run("empty alerts in payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, nil)

		payload, err := json.Marshal(AlertBroadcastPayload{
			OrgID:  1,
			Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}},
		})
		require.NoError(t, err)

		err = state.Merge(payload)
		require.NoError(t, err)
	})

	t.Run("delivers alerts to alertmanager and increments received metric", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := metrics.NewNGAlert(reg)

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
		state := newAlertBroadcastState(log.NewNopLogger(), moa, m.GetMultiOrgAlertmanagerMetrics())

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

		require.Equal(t, 3, int(testGetCounterValue(t, reg, "grafana_alerting_alert_broadcast_alerts_received_total")))
	})

	t.Run("alertmanager not found increments error metric", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := metrics.NewNGAlert(reg)

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: make(map[int64]Alertmanager),
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, m.GetMultiOrgAlertmanagerMetrics())

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

		require.Equal(t, 1, int(testGetCounterValueWithLabel(t, reg, "grafana_alerting_alert_broadcast_receive_errors_total", "reason", "alertmanager_unavailable")))
	})

	t.Run("alertmanager not ready increments error metric", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := metrics.NewNGAlert(reg)

		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(false)

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: mockAM},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, m.GetMultiOrgAlertmanagerMetrics())

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

		require.Equal(t, 1, int(testGetCounterValueWithLabel(t, reg, "grafana_alerting_alert_broadcast_receive_errors_total", "reason", "alertmanager_unavailable")))
	})

	t.Run("PutAlerts failure increments error metric", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := metrics.NewNGAlert(reg)

		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		mockAM.On("PutAlerts", mock.Anything, mock.Anything).Return(errors.New("test error"))

		moa := &MultiOrgAlertmanager{
			logger:        log.NewNopLogger(),
			alertmanagers: map[int64]Alertmanager{1: mockAM},
		}
		state := newAlertBroadcastState(log.NewNopLogger(), moa, m.GetMultiOrgAlertmanagerMetrics())

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

		require.Equal(t, 1, int(testGetCounterValueWithLabel(t, reg, "grafana_alerting_alert_broadcast_receive_errors_total", "reason", "put_alerts")))
	})
}

func TestInitAlertBroadcast(t *testing.T) {
	testCases := []struct {
		name          string
		setupPeer     func() (alertingNotify.ClusterPeer, *MockBroadcastChannel)
		expectChannel bool
		needsMetrics  bool
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			peer, expectedChannel := tc.setupPeer()
			moa := &MultiOrgAlertmanager{
				logger: log.NewNopLogger(),
				peer:   peer,
			}
			if tc.needsMetrics {
				reg := prometheus.NewRegistry()
				m := metrics.NewNGAlert(reg)
				moa.metrics = m.GetMultiOrgAlertmanagerMetrics()
			}

			moa.initAlertBroadcast()

			if tc.expectChannel {
				require.NotNil(t, moa.alertsBroadcastChannel)
				require.Equal(t, expectedChannel, moa.alertsBroadcastChannel)
			} else {
				require.Nil(t, moa.alertsBroadcastChannel)
			}
		})
	}
}

// Test helpers for metrics

func testGetCounterValue(t *testing.T, reg *prometheus.Registry, name string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() == name {
			return f.GetMetric()[0].GetCounter().GetValue()
		}
	}
	return 0
}

func testGetCounterValueWithLabel(t *testing.T, reg *prometheus.Registry, name, labelName, labelValue string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() == name {
			for _, metric := range f.GetMetric() {
				for _, label := range metric.GetLabel() {
					if label.GetName() == labelName && label.GetValue() == labelValue {
						return metric.GetCounter().GetValue()
					}
				}
			}
		}
	}
	return 0
}
