package alerting

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type MuteTimeV1 struct {
	OrgID    values.Int64Value            `json:"orgId" yaml:"orgId"`
	MuteTime definitions.MuteTimeInterval `json:",inline" yaml:",inline"`
}

func (v1 *MuteTimeV1) mapToModel() MuteTime {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return MuteTime{
		OrgID:    orgID,
		MuteTime: v1.MuteTime,
	}
}

type MuteTime struct {
	OrgID    int64
	MuteTime definitions.MuteTimeInterval
}

type DeleteMuteTimeV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

func (v1 *DeleteMuteTimeV1) mapToModel() (DeleteMuteTime, error) {
	name := strings.TrimSpace(v1.Name.Value())
	if name == "" {
		return DeleteMuteTime{}, errors.New("delete mute time missing name")
	}
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return DeleteMuteTime{
		OrgID: orgID,
		Name:  name,
	}, nil
}

type DeleteMuteTime struct {
	OrgID int64
	Name  string
}
