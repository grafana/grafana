// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kube-aggregator/blob/master/pkg/apis/apiregistration/v1/helper/helpers.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package helper

import (
	"strings"

	v0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DataPlaneServiceNameToGroupVersion returns the GroupVersion for a given dataplaneServiceNam.  The name
// must be valid, but any object you get back from an informer will be valid.
func DataPlaneServiceNameToGroupVersion(dataplaneServiceName string) schema.GroupVersion {
	tokens := strings.SplitN(dataplaneServiceName, ".", 2)
	return schema.GroupVersion{Group: tokens[1], Version: tokens[0]}
}

// SetDataPlaneServiceCondition sets the status condition.  It either overwrites the existing one or
// creates a new one
func SetDataPlaneServiceCondition(dataplaneService *v0alpha1.DataPlaneService, newCondition v0alpha1.DataPlaneServiceCondition) {
	existingCondition := GetDataPlaneServiceConditionByType(dataplaneService, newCondition.Type)
	if existingCondition == nil {
		dataplaneService.Status.Conditions = append(dataplaneService.Status.Conditions, newCondition)
		return
	}

	if existingCondition.Status != newCondition.Status {
		existingCondition.Status = newCondition.Status
		existingCondition.LastTransitionTime = newCondition.LastTransitionTime
	}

	existingCondition.Reason = newCondition.Reason
	existingCondition.Message = newCondition.Message
}

// IsDataPlaneServiceConditionTrue indicates if the condition is present and strictly true
func IsDataPlaneServiceConditionTrue(dataplaneService *v0alpha1.DataPlaneService, conditionType v0alpha1.DataPlaneServiceConditionType) bool {
	condition := GetDataPlaneServiceConditionByType(dataplaneService, conditionType)
	return condition != nil && condition.Status == v0alpha1.ConditionTrue
}

// GetDataPlaneServiceConditionByType gets an *DataPlaneServiceCondition by DataPlaneServiceConditionType if present
func GetDataPlaneServiceConditionByType(dataplaneService *v0alpha1.DataPlaneService, conditionType v0alpha1.DataPlaneServiceConditionType) *v0alpha1.DataPlaneServiceCondition {
	for i := range dataplaneService.Status.Conditions {
		if dataplaneService.Status.Conditions[i].Type == conditionType {
			return &dataplaneService.Status.Conditions[i]
		}
	}
	return nil
}
