package alerting

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type NotificiationPolicyV1 struct {
	OrgID values.Int64Value `json:"orgId" yaml:"orgId"`
	// We use JSONValue here, as we want to have interpolation the values.
	Policy values.JSONValue   `json:"-" yaml:"-"`
	Name   values.StringValue `json:"name" yaml:"name"`
}

func (v1 *NotificiationPolicyV1) UnmarshalYAML(unmarshal func(any) error) error {
	err := v1.Policy.UnmarshalYAML(unmarshal)
	if err != nil {
		return err
	}
	// As we also want to unmarshal the orgId and any other field that might be
	// added in the future we create an alias type that prevents recursion
	// and just uses the default marshler.
	type plain NotificiationPolicyV1
	return unmarshal((*plain)(v1))
}

func (v1 *NotificiationPolicyV1) mapToModel() (NotificiationPolicy, error) {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	name := v1.Name.Value()
	if name == "" {
		name = legacy_storage.UserDefinedRoutingTreeName
	}
	var route definitions.Route
	// We need the string json representation, so we marshal the policy back
	// as a string and interpolate it at the same time.
	data, err := json.Marshal(v1.Policy.Value())
	if err != nil {
		return NotificiationPolicy{}, err
	}
	// Now we can take the interpolated string json represtenation of the policy
	// and unmarshal it in the concrete type.
	err = json.Unmarshal(data, &route)
	if err != nil {
		return NotificiationPolicy{}, err
	}
	// We don't need any further validation here as it's done by
	// the notification policy service.
	return NotificiationPolicy{
		OrgID:  orgID,
		Policy: route,
		Name:   strings.TrimSpace(name),
	}, nil
}

type NotificiationPolicy struct {
	OrgID  int64
	Name   string
	Policy definitions.Route
}

type DeleteNotificationPolicyV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

func (v1 DeleteNotificationPolicyV1) mapToModel() (DeleteNotificationPolicy, error) {
	name := strings.TrimSpace(v1.Name.Value())
	if name == "" {
		return DeleteNotificationPolicy{}, errors.New("delete policy missing name")
	}
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return DeleteNotificationPolicy{
		OrgID: orgID,
		Name:  name,
	}, nil
}

type DeleteNotificationPolicy struct {
	OrgID int64
	Name  string
}
