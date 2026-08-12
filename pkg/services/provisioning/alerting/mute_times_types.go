package alerting

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type MuteTimeV1 struct {
	OrgID    values.Int64Value            `json:"orgId" yaml:"orgId"`
	MuteTime definitions.MuteTimeInterval `json:",inline" yaml:",inline"`
}

func (mt *MuteTimeV1) mapToModel() MuteTime {
	orgID := mt.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return MuteTime{
		OrgID: orgID,
		MuteTime: v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: models.ProvenanceFile,
			},
			Title:         mt.MuteTime.Name,
			TimeIntervals: mt.MuteTime.TimeIntervals,
		},
	}
}

type MuteTime struct {
	OrgID    int64
	MuteTime v1.TimeInterval
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
