package state

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type mockInstanceReader struct {
	mock.Mock
}

func (m *mockInstanceReader) FetchOrgIds(ctx context.Context) ([]int64, error) {
	args := m.Called(ctx)
	return args.Get(0).([]int64), args.Error(1)
}

func (m *mockInstanceReader) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) ([]*models.AlertInstance, error) {
	args := m.Called(ctx, cmd)
	return args.Get(0).([]*models.AlertInstance), args.Error(1)
}

func TestMultiInstanceReader_FetchOrgIds(t *testing.T) {
	tests := []struct {
		name           string
		mockAOrgIDs    []int64
		mockBOrgIDs    []int64
		mockAError     error
		mockBError     error
		expectedOrgIDs []int64
		expectError    bool
	}{
		{
			name:           "both readers empty, no errors",
			mockAOrgIDs:    []int64{},
			mockBOrgIDs:    []int64{},
			expectedOrgIDs: []int64{},
		},
		{
			name:           "simple union, no errors",
			mockAOrgIDs:    []int64{1, 2},
			mockBOrgIDs:    []int64{2, 3},
			expectedOrgIDs: []int64{1, 2, 3},
		},
		{
			name:        "error in readerA",
			mockAError:  errors.New("some error"),
			expectError: true,
		},
		{
			name:        "error in readerB",
			mockBError:  errors.New("another error"),
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			readerA := &mockInstanceReader{}
			if tc.mockAError != nil {
				readerA.On("FetchOrgIds", mock.Anything).Return([]int64(nil), tc.mockAError).Once()
			} else {
				readerA.On("FetchOrgIds", mock.Anything).Return(tc.mockAOrgIDs, nil).Once()
			}

			readerB := &mockInstanceReader{}
			if tc.mockBError != nil {
				readerB.On("FetchOrgIds", mock.Anything).Return([]int64(nil), tc.mockBError).Once()
			} else {
				readerB.On("FetchOrgIds", mock.Anything).Return(tc.mockBOrgIDs, nil).Once()
			}

			multi := NewMultiInstanceReader(&logtest.Fake{}, readerA, readerB)
			orgIDs, err := multi.FetchOrgIds(ctx)

			if tc.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.ElementsMatch(t, tc.expectedOrgIDs, orgIDs)

			readerA.AssertExpectations(t)
			readerB.AssertExpectations(t)
		})
	}
}

func TestMultiInstanceReader_ListAlertInstances(t *testing.T) {
	t1 := time.Unix(100, 0)
	t2 := time.Unix(200, 0)
	t3 := time.Unix(300, 0)

	ruleA := "rule-1"
	ruleB := "rule-2"

	instAOld := &models.AlertInstance{AlertInstanceKey: models.AlertInstanceKey{RuleUID: ruleA}, LastEvalTime: t1}
	instANew := &models.AlertInstance{AlertInstanceKey: models.AlertInstanceKey{RuleUID: ruleA}, LastEvalTime: t3}
	instBMid := &models.AlertInstance{AlertInstanceKey: models.AlertInstanceKey{RuleUID: ruleB}, LastEvalTime: t2}
	instASameTime := &models.AlertInstance{AlertInstanceKey: models.AlertInstanceKey{RuleUID: ruleA}, LastEvalTime: t1}

	tests := []struct {
		name              string
		readerAInstances  []*models.AlertInstance
		readerBInstances  []*models.AlertInstance
		readerAError      error
		readerBError      error
		expectedInstances []*models.AlertInstance
		expectError       bool
	}{
		{
			name:              "both readers return empty lists",
			readerAInstances:  []*models.AlertInstance{},
			readerBInstances:  []*models.AlertInstance{},
			expectedInstances: []*models.AlertInstance{},
		},
		{
			name:              "when readerB is empty, use instances from readerA",
			readerAInstances:  []*models.AlertInstance{instAOld},
			readerBInstances:  []*models.AlertInstance{},
			expectedInstances: []*models.AlertInstance{instAOld},
		},
		{
			name:              "when readerA is empty, use instances from readerB",
			readerAInstances:  []*models.AlertInstance{},
			readerBInstances:  []*models.AlertInstance{instANew},
			expectedInstances: []*models.AlertInstance{instANew},
		},
		{
			name:              "when same rule exists in both readers, picks instances from reader with newer evaluation time",
			readerAInstances:  []*models.AlertInstance{instAOld},
			readerBInstances:  []*models.AlertInstance{instANew},
			expectedInstances: []*models.AlertInstance{instANew},
		},
		{
			name:              "combines instances across rules using newest evaluation time per rule",
			readerAInstances:  []*models.AlertInstance{instAOld, instBMid},
			readerBInstances:  []*models.AlertInstance{instANew},
			expectedInstances: []*models.AlertInstance{instANew, instBMid},
		},
		{
			name:         "error from readerA",
			readerAError: errors.New("some error"),
			expectError:  true,
		},
		{
			name:         "error from readerB",
			readerBError: errors.New("another error"),
			expectError:  true,
		},
		{
			name:              "nil instances are filtered out from results",
			readerAInstances:  []*models.AlertInstance{nil, instAOld},
			readerBInstances:  []*models.AlertInstance{nil},
			expectedInstances: []*models.AlertInstance{instAOld},
		},
		{
			name:              "when instances have equal evaluation times, picks instances from readerA",
			readerAInstances:  []*models.AlertInstance{instAOld},
			readerBInstances:  []*models.AlertInstance{instASameTime},
			expectedInstances: []*models.AlertInstance{instAOld},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			mockA := &mockInstanceReader{}
			if tc.readerAError != nil {
				mockA.On("ListAlertInstances", mock.Anything, mock.Anything).Return([]*models.AlertInstance(nil), tc.readerAError).Once()
			} else {
				mockA.On("ListAlertInstances", mock.Anything, mock.Anything).Return(tc.readerAInstances, nil).Once()
			}

			mockB := &mockInstanceReader{}
			if tc.readerBError != nil {
				mockB.On("ListAlertInstances", mock.Anything, mock.Anything).Return([]*models.AlertInstance(nil), tc.readerBError).Once()
			} else {
				mockB.On("ListAlertInstances", mock.Anything, mock.Anything).Return(tc.readerBInstances, nil).Once()
			}

			multi := NewMultiInstanceReader(&logtest.Fake{}, mockA, mockB)
			cmd := &models.ListAlertInstancesQuery{RuleOrgID: 1234}
			got, err := multi.ListAlertInstances(ctx, cmd)

			if tc.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.ElementsMatch(t, tc.expectedInstances, got)

			mockA.AssertExpectations(t)
			mockB.AssertExpectations(t)
		})
	}
}
