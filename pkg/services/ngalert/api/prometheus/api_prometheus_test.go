package api

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestComputeRuleState(t *testing.T) {
	tests := []struct {
		name     string
		states   []*state.State
		expected eval.State
	}{
		{
			name:     "empty states returns Normal",
			states:   []*state.State{},
			expected: eval.Normal,
		},
		{
			name:     "nil states returns Normal",
			states:   nil,
			expected: eval.Normal,
		},
		{
			name: "single Normal state",
			states: []*state.State{
				{State: eval.Normal},
			},
			expected: eval.Normal,
		},
		{
			name: "single Alerting state",
			states: []*state.State{
				{State: eval.Alerting},
			},
			expected: eval.Alerting,
		},
		{
			name: "single Pending state",
			states: []*state.State{
				{State: eval.Pending},
			},
			expected: eval.Pending,
		},
		{
			name: "single Recovering state",
			states: []*state.State{
				{State: eval.Recovering},
			},
			expected: eval.Recovering,
		},
		{
			name: "Alerting takes priority over Pending",
			states: []*state.State{
				{State: eval.Pending},
				{State: eval.Alerting},
			},
			expected: eval.Alerting,
		},
		{
			name: "Alerting takes priority over Normal",
			states: []*state.State{
				{State: eval.Normal},
				{State: eval.Alerting},
			},
			expected: eval.Alerting,
		},
		{
			name: "Alerting takes priority over Recovering",
			states: []*state.State{
				{State: eval.Recovering},
				{State: eval.Alerting},
			},
			expected: eval.Alerting,
		},
		{
			name: "Pending takes priority over Normal",
			states: []*state.State{
				{State: eval.Normal},
				{State: eval.Pending},
			},
			expected: eval.Pending,
		},
		{
			name: "Recovering takes priority over Normal",
			states: []*state.State{
				{State: eval.Normal},
				{State: eval.Recovering},
			},
			expected: eval.Recovering,
		},
		{
			name: "first Pending wins over later Recovering",
			states: []*state.State{
				{State: eval.Pending},
				{State: eval.Recovering},
			},
			expected: eval.Pending,
		},
		{
			name: "first Recovering wins over later Pending",
			states: []*state.State{
				{State: eval.Recovering},
				{State: eval.Pending},
			},
			expected: eval.Recovering,
		},
		{
			name: "mixed states with Alerting",
			states: []*state.State{
				{State: eval.Normal},
				{State: eval.Pending},
				{State: eval.Alerting},
				{State: eval.Recovering},
			},
			expected: eval.Alerting,
		},
		{
			name: "Error and NoData are ignored",
			states: []*state.State{
				{State: eval.Error},
				{State: eval.NoData},
			},
			expected: eval.Normal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ComputeRuleState(tt.states)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRuleStateToAPIString(t *testing.T) {
	tests := []struct {
		name     string
		state    eval.State
		expected string
	}{
		{
			name:     "Normal returns inactive",
			state:    eval.Normal,
			expected: "inactive",
		},
		{
			name:     "Alerting returns firing",
			state:    eval.Alerting,
			expected: "firing",
		},
		{
			name:     "Pending returns pending",
			state:    eval.Pending,
			expected: "pending",
		},
		{
			name:     "Recovering returns recovering",
			state:    eval.Recovering,
			expected: "recovering",
		},
		{
			name:     "Error returns inactive",
			state:    eval.Error,
			expected: "inactive",
		},
		{
			name:     "NoData returns inactive",
			state:    eval.NoData,
			expected: "inactive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := RuleStateToAPIString(tt.state)
			assert.Equal(t, tt.expected, result)
		})
	}
}
