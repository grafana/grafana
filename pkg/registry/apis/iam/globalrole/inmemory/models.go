package inmemory

import (
	"fmt"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gapiutils "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

func roleDTOToV0GlobalRole(dto *accesscontrol.RoleDTO) *iamv0.GlobalRole {
	r := &iamv0.GlobalRole{
		TypeMeta: iamv0.GlobalRoleInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              dto.UID,
			ResourceVersion:   fmt.Sprintf("%d", dto.Version),
			CreationTimestamp: metav1.NewTime(dto.Created),
			Annotations: map[string]string{
				accesscontrol.RoleNameAnnotation: dto.Name,
			},
		},
		Spec: iamv0.GlobalRoleSpec{
			Title:       dto.DisplayName,
			Description: dto.Description,
			Group:       dto.Group,
			Permissions: toV0Permissions(dto.Permissions),
		},
	}
	r.SetUpdateTimestamp(dto.Updated)
	r.Annotations[utils.AnnoKeyUpdatedTimestamp] = dto.Updated.Format(time.RFC3339)
	if dto.Hidden {
		r.Annotations[accesscontrol.RoleHiddenAnnotation] = strconv.FormatBool(dto.Hidden)
	}
	r.SetGeneration(dto.Version)
	r.UID = gapiutils.CalculateClusterWideUID(r)

	// All basic roles are managed by grafana
	r.Annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindGrafana)
	r.Annotations[utils.AnnoKeyManagerIdentity] = "grafana"

	return r
}

func toV0Permissions(perms []accesscontrol.Permission) []iamv0.GlobalRolespecPermission {
	result := make([]iamv0.GlobalRolespecPermission, 0, len(perms))
	for _, p := range perms {
		result = append(result, iamv0.GlobalRolespecPermission{
			Action: p.Action,
			Scope:  p.Scope,
		})
	}
	return result
}
