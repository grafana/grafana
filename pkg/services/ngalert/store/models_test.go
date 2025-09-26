package store

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

func TestAlertRuleVersion_EqualSpec(t *testing.T) {
	baseVersion := alertRuleVersion{
		RuleOrgID:                   1,
		RuleGUID:                    "guid1",
		RuleUID:                     "uid1",
		RuleGroup:                   "group1",
		Title:                       "Sample",
		Condition:                   "cond",
		Data:                        "data",
		IntervalSeconds:             60,
		Record:                      "record",
		NoDataState:                 "state1",
		ExecErrState:                "state2",
		For:                         time.Minute,
		Annotations:                 `{ "test": "annotation" }`,
		Labels:                      `{ "test": "label" }`,
		IsPaused:                    true,
		NotificationSettings:        `{ some json object }`,
		Metadata:                    `{ some json object }`,
		MissingSeriesEvalsToResolve: util.Pointer(int64(10)),
	}

	tests := []struct {
		name   string
		a      alertRuleVersion
		b      alertRuleVersion
		expect bool
	}{
		{
			name:   "equal versions",
			a:      baseVersion,
			b:      baseVersion,
			expect: true,
		},
		{
			name:   "different RuleOrgID",
			a:      baseVersion,
			b:      func() alertRuleVersion { v := baseVersion; v.RuleOrgID = 2; return v }(),
			expect: false,
		},
		{
			name:   "different RuleGUID",
			a:      baseVersion,
			b:      func() alertRuleVersion { v := baseVersion; v.RuleGUID = "guid2"; return v }(),
			expect: false,
		},
		{
			name:   "different Title",
			a:      baseVersion,
			b:      func() alertRuleVersion { v := baseVersion; v.Title = "Title2"; return v }(),
			expect: false,
		},
		{
			name:   "nil MissingSeriesEvalsToResolve in one version",
			a:      func() alertRuleVersion { v := baseVersion; v.MissingSeriesEvalsToResolve = nil; return v }(),
			b:      baseVersion,
			expect: false,
		},
		{
			name:   "both MissingSeriesEvalsToResolve nil",
			a:      func() alertRuleVersion { v := baseVersion; v.MissingSeriesEvalsToResolve = nil; return v }(),
			b:      func() alertRuleVersion { v := baseVersion; v.MissingSeriesEvalsToResolve = nil; return v }(),
			expect: true,
		},
		{
			name: "same MissingSeriesEvalsToResolve value, different pointers",
			a: func() alertRuleVersion {
				v := baseVersion
				v.MissingSeriesEvalsToResolve = util.Pointer(int64(10))
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.MissingSeriesEvalsToResolve = util.Pointer(int64(10))
				return v
			}(),
			expect: true,
		},
		{
			name: "different MissingSeriesEvalsToResolve",
			a: func() alertRuleVersion {
				v := baseVersion
				v.MissingSeriesEvalsToResolve = util.Pointer(int64(123))
				return v
			}(),
			b:      baseVersion,
			expect: false,
		},
		{
			name:   "different NotificationSettings",
			a:      baseVersion,
			b:      func() alertRuleVersion { v := baseVersion; v.NotificationSettings = "notify2"; return v }(),
			expect: false,
		},
		{
			name: "complex mismatch",
			a:    baseVersion,
			b: func() alertRuleVersion {
				v := baseVersion
				v.RuleOrgID = 2
				v.RuleGUID = "guid2"
				v.Title = "Title2"
				return v
			}(),
			expect: false,
		},
		{
			name:   "different For durations",
			a:      baseVersion,
			b:      func() alertRuleVersion { v := baseVersion; v.For = 2 * time.Minute; return v }(),
			expect: false,
		},
		{
			name: "exact match including bools and other types",
			a: func() alertRuleVersion {
				v := baseVersion
				v.IsPaused = true
				v.Metadata = "meta1"
				v.Labels = "label1"
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.IsPaused = true
				v.Metadata = "meta1"
				v.Labels = "label1"
				return v
			}(),
			expect: true,
		},
		{
			name: "different ID but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.ID = 1
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.ID = 2
				return v
			}(),
			expect: true,
		},
		{
			name: "different ParentVersion but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.ParentVersion = 1
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.ParentVersion = 2
				return v
			}(),
			expect: true,
		},
		{
			name: "different RestoredFrom but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.RestoredFrom = 1
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.RestoredFrom = 2
				return v
			}(),
			expect: true,
		},
		{
			name: "different Version but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.Version = 1
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.Version = 2
				return v
			}(),
			expect: true,
		},
		{
			name: "different Created but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.Created = time.Now()
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.Created = time.Now().Add(time.Hour)
				return v
			}(),
			expect: true,
		},
		{
			name: "different RuleGroupIndex but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.RuleGroupIndex = 1
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.RuleGroupIndex = 2
				return v
			}(),
			expect: true,
		},
		{
			name: "different CreatedBy but otherwise equal",
			a: func() alertRuleVersion {
				v := baseVersion
				v.CreatedBy = util.Pointer("user1")
				return v
			}(),
			b: func() alertRuleVersion {
				v := baseVersion
				v.CreatedBy = util.Pointer("user2")
				return v
			}(),
			expect: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.a.EqualSpec(tt.b); got != tt.expect {
				t.Errorf("EqualSpec() = %v, expect %v", got, tt.expect)
			}
		})
	}
}
