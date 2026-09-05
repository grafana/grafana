package notifier

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
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
			alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test alert"}}}},
			channelExists: true,
			expected: &AlertBroadcastPayload{
				OrgID:  1,
				Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test alert"}}}},
			},
		},
		{
			name:          "does not broadcast when channel is nil",
			orgID:         1,
			alerts:        apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test alert"}}}},
			channelExists: false,
		},
		{
			name:          "does not broadcast empty alerts",
			orgID:         1,
			alerts:        apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}},
			channelExists: true,
		},
		{
			name:          "does not broadcast nil alerts",
			orgID:         1,
			alerts:        apimodels.PostableAlerts{},
			channelExists: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockChannel := &MockBroadcastChannel{}
			moa := &MultiOrgAlertmanager{logger: log.NewNopLogger()}
			if tc.channelExists {
				moa.alertsBroadcastChannel = mockChannel
			}
			moa.BroadcastAlerts(tc.orgID, tc.alerts)

			if tc.expected == nil {
				require.Empty(t, mockChannel.Broadcasts())
			} else {
				require.Len(t, mockChannel.Broadcasts(), 1)
				var decoded AlertBroadcastPayload
				require.NoError(t, json.Unmarshal(mockChannel.Broadcasts()[0], &decoded))
				require.Equal(t, *tc.expected, decoded)
			}
		})
	}
}

func TestAlertBroadcast_MarshalBinary(t *testing.T) {
	state := newAlertBroadcastState(log.NewNopLogger(), nil)
	data, err := state.MarshalBinary()
	require.NoError(t, err)
	require.Nil(t, data, "MarshalBinary should return nil for alert broadcast state (no full state sync)")
}

func TestAlertBroadcast_Merge(t *testing.T) {
	t.Run("empty payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: make(map[int64]Alertmanager)}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		require.NoError(t, state.Merge([]byte{}))
	})

	t.Run("nil payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: make(map[int64]Alertmanager)}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		require.NoError(t, state.Merge(nil))
	})

	t.Run("invalid JSON returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: make(map[int64]Alertmanager)}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		require.NoError(t, state.Merge([]byte("not valid json")))
	})

	t.Run("empty alerts in payload returns nil", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: make(map[int64]Alertmanager)}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{}}})
		require.NoError(t, err)
		require.NoError(t, state.Merge(payload))
	})

	t.Run("delivers alerts to alertmanager", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		delivered := make(chan struct{})
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
		})).Run(func(mock.Arguments) { close(delivered) }).Return(nil)

		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: map[int64]Alertmanager{1: mockAM}}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{
			{Annotations: amv2.LabelSet{"summary": "alert 1"}},
			{Annotations: amv2.LabelSet{"summary": "alert 2"}},
			{Annotations: amv2.LabelSet{"summary": "alert 3"}},
		}}})
		require.NoError(t, err)
		require.NoError(t, state.Merge(payload))
		require.Eventually(t, func() bool { select { case <-delivered: return true; default: return false } }, time.Second, 10*time.Millisecond)
		mockAM.AssertExpectations(t)
	})

	t.Run("returns immediately when PutAlerts blocks", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		entered := make(chan struct{})
		release := make(chan struct{})
		mockAM.On("PutAlerts", mock.Anything, mock.Anything).Run(func(mock.Arguments) { close(entered); <-release }).Return(nil)

		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: map[int64]Alertmanager{1: mockAM}}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test"}}}}})
		require.NoError(t, err)

		start := time.Now()
		require.NoError(t, state.Merge(payload))
		require.Less(t, time.Since(start), 100*time.Millisecond)
		require.Eventually(t, func() bool { select { case <-entered: return true; default: return false } }, time.Second, 10*time.Millisecond)
		close(release)
	})

	t.Run("skips when alertmanager not found", func(t *testing.T) {
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: make(map[int64]Alertmanager)}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 999, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test"}}}}})
		require.NoError(t, err)
		require.NoError(t, state.Merge(payload))
	})

	t.Run("skips when alertmanager not ready", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(false)
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: map[int64]Alertmanager{1: mockAM}}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test"}}}}})
		require.NoError(t, err)
		require.NoError(t, state.Merge(payload))
		time.Sleep(10 * time.Millisecond)
		mockAM.AssertNotCalled(t, "PutAlerts", mock.Anything, mock.Anything)
	})

	t.Run("does not return error when PutAlerts fails", func(t *testing.T) {
		mockAM := alertmanager_mock.NewAlertmanagerMock(t)
		mockAM.On("Ready").Return(true)
		failed := make(chan struct{})
		mockAM.On("PutAlerts", mock.Anything, mock.Anything).Run(func(mock.Arguments) { close(failed) }).Return(errors.New("test error"))
		moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), alertmanagers: map[int64]Alertmanager{1: mockAM}}
		state := newAlertBroadcastState(log.NewNopLogger(), moa)
		payload, err := json.Marshal(AlertBroadcastPayload{OrgID: 1, Alerts: apimodels.PostableAlerts{PostableAlerts: []amv2.PostableAlert{{Annotations: amv2.LabelSet{"summary": "test"}}}}})
		require.NoError(t, err)
		require.NoError(t, state.Merge(payload))
		require.Eventually(t, func() bool { select { case <-failed: return true; default: return false } }, time.Second, 10*time.Millisecond)
		mockAM.AssertExpectations(t)
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
		{name: "does not initialize when peer is nil", setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) { return nil, nil }, expectChannel: false},
		{name: "does not initialize when peer is NilPeer", setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) { return &NilPeer{}, nil }, expectChannel: false},
		{name: "initializes when peer is not NilPeer", setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) { ch := &MockBroadcastChannel{}; return &MockClusterPeer{Channel: ch}, ch }, expectChannel: true, needsMetrics: true},
		{name: "passes reliable delivery and queue size options", setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) { ch := &MockBroadcastChannel{}; return &MockClusterPeer{Channel: ch}, ch }, expectChannel: true, needsMetrics: true},
		{name: "passes custom queue size from config", setupPeer: func() (alertingNotify.ClusterPeer, *MockBroadcastChannel) { ch := &MockBroadcastChannel{}; return &MockClusterPeer{Channel: ch}, ch }, expectChannel: true, needsMetrics: true, customQueueSize: 500},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			peer, expectedChannel := tc.setupPeer()
			moa := &MultiOrgAlertmanager{logger: log.NewNopLogger(), peer: peer}
			if tc.needsMetrics {
				queueSize := tc.customQueueSize
				if queueSize == 0 {
					queueSize = 200
				}
				reg := prometheus.NewRegistry()
				m := metrics.NewNGAlert(reg)
				moa.metrics = m.GetMultiOrgAlertmanagerMetrics()
				moa.settings = &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{HASingleEvaluationAlertBroadcastQueueSize: queueSize}}
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
