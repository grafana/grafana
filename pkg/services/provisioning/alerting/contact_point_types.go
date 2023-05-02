package alerting

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type DeleteContactPointV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	UID   values.StringValue `json:"uid" yaml:"uid"`
}

func (v1 *DeleteContactPointV1) MapToModel() DeleteContactPoint {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	return DeleteContactPoint{
		OrgID: orgID,
		UID:   v1.UID.Value(),
	}
}

type DeleteContactPoint struct {
	OrgID int64  `json:"orgId" yaml:"orgId"`
	UID   string `json:"uid" yaml:"uid"`
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
		return ContactPoint{}, fmt.Errorf("no name is set")
	}
	for _, receiverV1 := range cpV1.Receivers {
		embeddedCP, err := receiverV1.mapToModel(name)
		if err != nil {
			return ContactPoint{}, fmt.Errorf("%s: %w", name, err)
		}
		contactPoint.ContactPoints = append(contactPoint.ContactPoints, embeddedCP)
	}
	return contactPoint, nil
}

type ContactPoint struct {
	OrgID         int64                              `json:"orgId" yaml:"orgId"`
	ContactPoints []definitions.EmbeddedContactPoint `json:"configs" yaml:"configs"`
}

type ReceiverV1 struct {
	UID                   values.StringValue `json:"uid" yaml:"uid"`
	Type                  values.StringValue `json:"type" yaml:"type"`
	Settings              values.JSONValue   `json:"settings" yaml:"settings"`
	DisableResolveMessage values.BoolValue   `json:"disableResolveMessage" yaml:"disableResolveMessage"`
}

func (config *ReceiverV1) mapToModel(name string) (definitions.EmbeddedContactPoint, error) {
	uid := strings.TrimSpace(config.UID.Value())
	if uid == "" {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("no uid is set")
	}
	cpType := strings.TrimSpace(config.Type.Value())
	if cpType == "" {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("no type is set")
	}
	if len(config.Settings.Value()) == 0 {
		return definitions.EmbeddedContactPoint{}, fmt.Errorf("no settings are set")
	}
	settings := simplejson.NewFromAny(config.Settings.Value())
	cp := definitions.EmbeddedContactPoint{
		UID:                   uid,
		Name:                  name,
		Type:                  cpType,
		DisableResolveMessage: config.DisableResolveMessage.Value(),
		Provenance:            string(models.ProvenanceFile),
		Settings:              settings,
	}
	// As the values are not encrypted when coming from disk files,
	// we can simply return the fallback for validation.
	err := provisioning.ValidateContactPoint(context.Background(), cp, func(_ context.Context, _ map[string][]byte, _, fallback string) string {
		return fallback
	})
	if err != nil {
		return definitions.EmbeddedContactPoint{}, err
	}
	return cp, nil
}
