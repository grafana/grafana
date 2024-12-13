package secret

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

var (
	ErrKeeperNotFound = errutil.NotFound("cloudmigrations.sessionNotFound").Errorf("Session not found")
)

var (
	// Exclude these annotations
	skipAnnotations = map[string]bool{
		"kubectl.kubernetes.io/last-applied-configuration": true, // force server side apply
		utils.AnnoKeyCreatedBy:                             true,
		utils.AnnoKeyUpdatedBy:                             true,
		utils.AnnoKeyUpdatedTimestamp:                      true,
	}
)

func CleanAnnotations(anno map[string]string) map[string]string {
	copy := make(map[string]string)
	for k, v := range anno {
		if skipAnnotations[k] {
			continue
		}
		copy[k] = v
	}
	return copy
}

type Keeper struct {
	// K8 Metadata
	GUID        string `xorm:"pk 'gid'"`
	Name        string `xorm:"'name'"`
	Namespace   string `xorm:"'namespace'"`
	Annotations string `xorm:"'annotations'"` // map[string]string
	Labels      string `xorm:"'labels'"`      // map[string]string
	Created     int64  `xorm:"'created'"`
	CreatedBy   string `xorm:"'created_by'"`
	Updated     int64  `xorm:"'updated'"`
	UpdatedBy   string `xorm:"'updated_by'"`

	// Spec
	Title   string `xorm:"'title'"`
	Type    string `xorm:"'type'"`
	Payload string `xorm:"'payload'"` // map[string]interface{}
}

// Convert everything from row structure to k8s representation.
func (kp *Keeper) toK8s() (*secretv0alpha1.Keeper, error) {
	annotations := make(map[string]string, 0)
	if kp.Annotations != "" {
		if err := json.Unmarshal([]byte(kp.Annotations), &annotations); err != nil {
			return nil, fmt.Errorf("failed to unmarshal annotations: %w", err)
		}
	}

	labels := make(map[string]string, 0)
	if kp.Labels != "" {
		if err := json.Unmarshal([]byte(kp.Labels), &labels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal labels: %w", err)
		}
	}

	resource := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Title: kp.Title,
		},
	}

	// Set all meta fields here for consistency
	meta, err := utils.MetaAccessor(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updated := time.Unix(kp.Updated, 0).UTC()

	meta.SetUID(types.UID(kp.GUID))
	meta.SetName(kp.Name)
	meta.SetNamespace(kp.Namespace)
	meta.SetAnnotations(annotations)
	meta.SetLabels(labels)
	meta.SetCreatedBy(kp.CreatedBy)
	meta.SetCreationTimestamp(metav1.NewTime(time.Unix(kp.Created, 0).UTC()))
	meta.SetUpdatedBy(kp.UpdatedBy)
	meta.SetUpdatedTimestamp(&updated)
	// meta.SetResourceVersionInt64(kp.Updated)

	return resource, nil
}

// toCreateRow maps a Kubernetes resource into a DB row for new resources being created/inserted
func toCreateRow(kp *secretv0alpha1.Keeper, actorUID string) (*Keeper, error) {
	row, err := toRow(kp)
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	now := time.Now().UTC().UnixMilli()

	row.GUID = uuid.New().String()
	row.Created = now
	row.CreatedBy = actorUID
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

// toRow maps a Kubernetes resource into a DB row
func toRow(sv *secretv0alpha1.Keeper) (*Keeper, error) {
	var annotations string
	if len(sv.Annotations) > 0 {
		cleanedAnnotations := CleanAnnotations(sv.Annotations)
		if len(cleanedAnnotations) > 0 {
			sv.Annotations = make(map[string]string)

			encodedAnnotations, err := json.Marshal(cleanedAnnotations)
			if err != nil {
				return nil, fmt.Errorf("failed to encode annotations: %w", err)
			}

			annotations = string(encodedAnnotations)
		}
	}

	var labels string
	if len(sv.Labels) > 0 {
		encodedLabels, err := json.Marshal(sv.Labels)
		if err != nil {
			return nil, fmt.Errorf("failed to encode labels: %w", err)
		}

		labels = string(encodedLabels)
	}

	meta, err := utils.MetaAccessor(sv)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updatedTimestamp, err := meta.GetResourceVersionInt64()
	if err != nil {
		return nil, fmt.Errorf("failed to get resource version: %w", err)
	}

	return &Keeper{
		GUID:        string(sv.UID),
		Name:        sv.Name,
		Namespace:   sv.Namespace,
		Annotations: annotations,
		Labels:      labels,
		Created:     meta.GetCreationTimestamp().UnixMilli(),
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     updatedTimestamp,
		UpdatedBy:   meta.GetUpdatedBy(),

		Title: sv.Spec.Title,

		// TODO: Add these fields
		Type:    "todo-type",
		Payload: "todo-payload",
	}, nil
}
