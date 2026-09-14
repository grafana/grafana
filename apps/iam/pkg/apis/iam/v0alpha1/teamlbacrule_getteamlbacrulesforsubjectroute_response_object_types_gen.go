// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// +k8s:openapi-gen=true
type GetTeamLBACRulesForSubjectRouteResponse struct {
	metav1.TypeMeta                     `json:",inline"`
	GetTeamLBACRulesForSubjectRouteBody `json:",inline"`
}

func NewGetTeamLBACRulesForSubjectRouteResponse() *GetTeamLBACRulesForSubjectRouteResponse {
	return &GetTeamLBACRulesForSubjectRouteResponse{}
}

func (t *GetTeamLBACRulesForSubjectRouteBody) DeepCopyInto(dst *GetTeamLBACRulesForSubjectRouteBody) {
	_ = resource.CopyObjectInto(dst, t)
}

func (o *GetTeamLBACRulesForSubjectRouteResponse) DeepCopyObject() runtime.Object {
	dst := NewGetTeamLBACRulesForSubjectRouteResponse()
	o.DeepCopyInto(dst)
	return dst
}

func (o *GetTeamLBACRulesForSubjectRouteResponse) DeepCopyInto(dst *GetTeamLBACRulesForSubjectRouteResponse) {
	dst.TypeMeta.APIVersion = o.TypeMeta.APIVersion
	dst.TypeMeta.Kind = o.TypeMeta.Kind
	o.GetTeamLBACRulesForSubjectRouteBody.DeepCopyInto(&dst.GetTeamLBACRulesForSubjectRouteBody)
}

func (GetTeamLBACRulesForSubjectRouteResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamLBACRulesForSubjectRouteResponse"
}

var _ runtime.Object = NewGetTeamLBACRulesForSubjectRouteResponse()
