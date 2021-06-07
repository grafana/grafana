package models

import (
	"errors"
	"fmt"
	"time"
)

var (
	// ErrAlertRuleNotFound is an error for an unknown alert rule.
	ErrAlertRuleNotFound = fmt.Errorf("could not find alert rule")
	// ErrAlertRuleFailedGenerateUniqueUID is an error for failure to generate alert rule UID
	ErrAlertRuleFailedGenerateUniqueUID = errors.New("failed to generate alert rule UID")
	// ErrCannotEditNamespace is an error returned if the user does not have permissions to edit the namespace
	ErrCannotEditNamespace = errors.New("user does not have permissions to edit the namespace")
	// ErrRuleGroupNamespaceNotFound
	ErrRuleGroupNamespaceNotFound = errors.New("rule group not found under this namespace")
	// ErrAlertRuleFailedValidation
	ErrAlertRuleFailedValidation = errors.New("invalid alert rule")
	// ErrAlertRuleUniqueConstraintViolation
	ErrAlertRuleUniqueConstraintViolation = errors.New("a conflicting alert rule is found: rule title under the same organisation and folder should be unique")
)

type NoDataState string

func (noDataState NoDataState) String() string {
	return string(noDataState)
}

const (
	Alerting NoDataState = "Alerting"
	NoData   NoDataState = "NoData"
	OK       NoDataState = "OK"
)

type ExecutionErrorState string

func (executionErrorState ExecutionErrorState) String() string {
	return string(executionErrorState)
}

const (
	AlertingErrState ExecutionErrorState = "Alerting"
)

const (
	UIDLabel          = "__alert_rule_uid__"
	NamespaceUIDLabel = "__alert_rule_namespace_uid__"
)

// AlertRule is the model for alert rules in unified alerting.
type AlertRule struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []AlertQuery
	Updated         time.Time
	IntervalSeconds int64
	Version         int64
	UID             string `xorm:"uid"`
	NamespaceUID    string `xorm:"namespace_uid"`
	RuleGroup       string
	NoDataState     NoDataState
	ExecErrState    ExecutionErrorState
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         time.Duration
	Annotations map[string]string
	Labels      map[string]string
}

// AlertRuleKey is the alert definition identifier
type AlertRuleKey struct {
	OrgID int64
	UID   string
}

func (k AlertRuleKey) String() string {
	return fmt.Sprintf("{orgID: %d, UID: %s}", k.OrgID, k.UID)
}

// GetKey returns the alert definitions identifier
func (alertRule *AlertRule) GetKey() AlertRuleKey {
	return AlertRuleKey{OrgID: alertRule.OrgID, UID: alertRule.UID}
}

// PreSave sets default values and loads the updated model for each alert query.
func (alertRule *AlertRule) PreSave(timeNow func() time.Time) error {
	for i, q := range alertRule.Data {
		err := q.PreSave()
		if err != nil {
			return fmt.Errorf("invalid alert query %s: %w", q.RefID, err)
		}
		alertRule.Data[i] = q
	}
	alertRule.Updated = timeNow()
	return nil
}

// AlertRuleVersion is the model for alert rule versions in unified alerting.
type AlertRuleVersion struct {
	ID               int64  `xorm:"pk autoincr 'id'"`
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
	ParentVersion    int64
	RestoredFrom     int64
	Version          int64

	Created         time.Time
	Title           string
	Condition       string
	Data            []AlertQuery
	IntervalSeconds int64
	NoDataState     NoDataState
	ExecErrState    ExecutionErrorState
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         time.Duration
	Annotations map[string]string
	Labels      map[string]string
}

// GetAlertRuleByUIDQuery is the query for retrieving/deleting an alert rule by UID and organisation ID.
type GetAlertRuleByUIDQuery struct {
	UID   string
	OrgID int64

	Result *AlertRule
}

// ListAlertRulesQuery is the query for listing alert rules
type ListAlertRulesQuery struct {
	OrgID int64

	Result []*AlertRule
}

// ListNamespaceAlertRulesQuery is the query for listing namespace alert rules
type ListNamespaceAlertRulesQuery struct {
	OrgID int64
	// Namespace is the folder slug
	NamespaceUID string

	Result []*AlertRule
}

// ListRuleGroupAlertRulesQuery is the query for listing rule group alert rules
type ListRuleGroupAlertRulesQuery struct {
	OrgID int64
	// Namespace is the folder slug
	NamespaceUID string
	RuleGroup    string

	Result []*AlertRule
}

// ListOrgRuleGroupsQuery is the query for listing unique rule groups
type ListOrgRuleGroupsQuery struct {
	OrgID int64

	Result [][]string
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	// Condition is the RefID of the query or expression from
	// the Data property to get the results for.
	Condition string `json:"condition"`
	OrgID     int64  `json:"-"`

	// Data is an array of data source queries and/or server side expressions.
	Data []AlertQuery `json:"data"`
}

// IsValid checks the condition's validity.
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.Data) != 0
}
