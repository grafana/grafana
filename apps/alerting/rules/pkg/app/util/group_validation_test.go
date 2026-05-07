package util

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func TestValidateGroupLabels(t *testing.T) {
	group := model.GroupLabelKey
	groupIdx := model.GroupIndexLabelKey

	tests := []struct {
		name      string
		labels    map[string]string
		oldLabels map[string]string
		action    resource.AdmissionAction
		wantErr   bool
	}{
		{
			name:    "update empty group value",
			labels:  map[string]string{group: "", groupIdx: "1"},
			action:  resource.AdmissionActionUpdate,
			wantErr: true,
		},
		{
			name:    "update empty group-index value",
			labels:  map[string]string{group: "g1", groupIdx: ""},
			action:  resource.AdmissionActionUpdate,
			wantErr: true,
		},
		{
			name:    "create empty group value disallowed",
			labels:  map[string]string{group: ""},
			action:  resource.AdmissionActionCreate,
			wantErr: true,
		},
		{
			name:    "create no labels allowed",
			labels:  nil,
			action:  resource.AdmissionActionCreate,
			wantErr: false,
		},
		{
			name:    "create with group disallowed",
			labels:  map[string]string{group: "g1"},
			action:  resource.AdmissionActionCreate,
			wantErr: true,
		},
		{
			name:    "create with group-index disallowed",
			labels:  map[string]string{groupIdx: "1"},
			action:  resource.AdmissionActionCreate,
			wantErr: true,
		},
		{
			name:    "update missing paired index",
			labels:  map[string]string{group: "g1"},
			action:  resource.AdmissionActionUpdate,
			wantErr: true,
		},
		{
			name:    "update missing paired group",
			labels:  map[string]string{groupIdx: "1"},
			action:  resource.AdmissionActionUpdate,
			wantErr: true,
		},
		{
			name:      "update invalid index format",
			labels:    map[string]string{group: "g1", groupIdx: "x"},
			oldLabels: map[string]string{group: "g1", groupIdx: "0"},
			action:    resource.AdmissionActionUpdate,
			wantErr:   true,
		},
		{
			name:      "update cannot add group when previously ungrouped",
			labels:    map[string]string{group: "g1", groupIdx: "0"},
			oldLabels: map[string]string{},
			action:    resource.AdmissionActionUpdate,
			wantErr:   true,
		},
		{
			name:      "update allowed when previously grouped",
			labels:    map[string]string{group: "g1", groupIdx: "2"},
			oldLabels: map[string]string{group: "g1", groupIdx: "1"},
			action:    resource.AdmissionActionUpdate,
			wantErr:   false,
		},
		{
			name:    "update no labels remains allowed",
			labels:  nil,
			action:  resource.AdmissionActionUpdate,
			wantErr: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateGroupLabels(tc.labels, tc.oldLabels, tc.action)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
