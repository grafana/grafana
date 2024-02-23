package alerting

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type TimeIntervalV1 struct {
	OrgID        values.Int64Value        `json:"orgId" yaml:"orgId"`
	TimeInterval definitions.TimeInterval `json:",inline" yaml:",inline"`
}

func (v1 *TimeIntervalV1) mapToModel() TimeInterval {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return TimeInterval{
		OrgID:        orgID,
		TimeInterval: v1.TimeInterval,
	}
}

type TimeInterval struct {
	OrgID        int64
	TimeInterval definitions.TimeInterval
}

type DeleteTimeIntervalV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

func (v1 *DeleteTimeIntervalV1) mapToModel() (DeleteTimeInterval, error) {
	name := strings.TrimSpace(v1.Name.Value())
	if name == "" {
		return DeleteTimeInterval{}, errors.New("delete time interval missing name")
	}
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return DeleteTimeInterval{
		OrgID: orgID,
		Name:  name,
	}, nil
}

type DeleteTimeInterval struct {
	OrgID int64
	Name  string
}
