package alerting

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type DeleteContactPointV1 struct {
	UID values.StringValue `json:"uid" yaml:"uid"`
}

type ContactPointV1 struct {
	OrgID     values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name      values.StringValue `json:"name" yaml:"name"`
	Receivers []ReceiverV1       `json:"receivers" yaml:"receivers"`
}

func (cpV1 *ContactPointV1) MapToModel() (ContactPoint, error) {
	contactPoint := ContactPoint{}
	orgID := cpV1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	contactPoint.OrgID = orgID
	name := strings.TrimSpace(cpV1.Name.Value())
	if name == "" {
		return ContactPoint{}, fmt.Errorf("")
	}
	for _, receiverV1 := range cpV1.Receivers {
		embeddedCP, err := receiverV1.mapToModel(name)
		if err != nil {
			return ContactPoint{}, err
		}
		contactPoint.ContactPoints = append(contactPoint.ContactPoints, embeddedCP)
	}
	return contactPoint, nil
}

type ContactPoint struct {
	OrgID         int64
	ContactPoints []definitions.EmbeddedContactPoint
}

type ReceiverV1 struct {
	UID                   values.StringValue `json:"uid" yaml:"uid"`
	Type                  values.StringValue `json:"type" yaml:"type"`
	Settings              values.JSONValue   `json:"settings" yaml:"settings"`
	DisableResolveMessage values.BoolValue   `json:"disableResolveMessage"`
}

func (config *ReceiverV1) mapToModel(name string) (definitions.EmbeddedContactPoint, error) {
	uid := strings.TrimSpace(config.UID.Value())
	if uid == "" {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("")
	}
	cpType := strings.TrimSpace(config.Type.Value())
	if cpType == "" {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("")
	}
	if len(config.Settings.Value()) == 0 {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("")
	}
	var settings simplejson.Json
	settingsRaw, err := json.Marshal(config.Settings)
	if err != nil {
		return definitions.EmbeddedContactPoint{}, err
	}
	err = json.Unmarshal(settingsRaw, &settings)
	if err != nil {
		return definitions.EmbeddedContactPoint{}, err
	}
	return definitions.EmbeddedContactPoint{
		UID:                   uid,
		Name:                  name,
		Type:                  cpType,
		DisableResolveMessage: config.DisableResolveMessage.Value(),
		Provenance:            string(models.ProvenanceFile),
		Settings:              &settings,
	}, nil
}
