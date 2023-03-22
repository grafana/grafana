package publicdashboard

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/kinds/publicdashboard"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func modelToK8sObject(namespace string, pdModel *publicdashboardModels.PublicDashboard) (*PublicDashboard, error) {
	// get annotations
	annotations, err := annotationsFromModel(pdModel)
	if err != nil {
		return nil, fmt.Errorf("error getting annotations from public dashboard: %s", err)
	}

	// set object meta
	meta := metav1.ObjectMeta{
		Name:        pdModel.Uid,
		Namespace:   namespace,
		Annotations: annotations,
	}

	// create a publicdashboard kind object and assign values used in create
	pd := &publicdashboard.PublicDashboard{}
	pd.Uid = pdModel.Uid
	pd.DashboardUid = pdModel.DashboardUid
	pd.AccessToken = &pdModel.AccessToken
	pd.AnnotationsEnabled = pdModel.AnnotationsEnabled
	pd.TimeSelectionEnabled = pdModel.TimeSelectionEnabled
	pd.IsEnabled = pdModel.IsEnabled

	publicdashboardObj := crd.Base[publicdashboard.PublicDashboard]{
		TypeMeta: metav1.TypeMeta{
			Kind:       CRD.GVK().Kind,
			APIVersion: CRD.GVK().Group + "/" + CRD.GVK().Version,
		},
		ObjectMeta: meta,
		Spec:       *pd,
	}

	return &PublicDashboard{publicdashboardObj}, nil
}

func annotationsFromModel(pd *publicdashboardModels.PublicDashboard) (map[string]string, error) {
	ts, err := pd.TimeSettings.ToDB()
	if err != nil {
		return nil, nil
	}

	annotations := map[string]string{
		"orgID":        strconv.FormatInt(pd.OrgId, 10),
		"updatedBy":    strconv.FormatInt(pd.UpdatedBy, 10),
		"updatedAt":    strconv.FormatInt(pd.UpdatedAt.UnixNano(), 10),
		"createdBy":    strconv.FormatInt(pd.CreatedBy, 10),
		"createdAt":    strconv.FormatInt(pd.CreatedAt.UnixNano(), 10),
		"dashboardUID": pd.DashboardUid,
		"timeSettings": string(ts),
	}

	return annotations, nil
}

// convert from k8s object to model
func k8sObjectToModel(pd *PublicDashboard) (*publicdashboardModels.PublicDashboard, error) {
	// make sure we have an accessToken
	if pd.Spec.AccessToken == nil {
		at := ""
		pd.Spec.AccessToken = &at
	}

	pdModel := &publicdashboardModels.PublicDashboard{
		Uid:                  pd.Spec.Uid,
		AccessToken:          *pd.Spec.AccessToken,
		DashboardUid:         pd.Spec.DashboardUid,
		AnnotationsEnabled:   pd.Spec.AnnotationsEnabled,
		TimeSelectionEnabled: pd.Spec.TimeSelectionEnabled,
		IsEnabled:            pd.Spec.IsEnabled,
	}

	// parse fields from annotations
	err := k8sAnnotationsToModel(pd, pdModel)
	if err != nil {
		return nil, err
	}

	return pdModel, nil
}

// get annotations off k8s object and put them on model
func k8sAnnotationsToModel(pd *PublicDashboard, pdModel *publicdashboardModels.PublicDashboard) error {
	var err error

	if pd.ObjectMeta.Annotations == nil {
		return nil
	}

	a := pd.ObjectMeta.Annotations

	if v, ok := a["orgID"]; ok {
		pdModel.OrgId, err = strconv.ParseInt(v, 10, 64)
		if err != nil {
			return err
		}
	}

	if v, ok := a["dashboardUid"]; ok {
		pdModel.DashboardUid = v
	}

	if v, ok := a["updatedBy"]; ok {
		updatedBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			pdModel.UpdatedBy = updatedBy
		}
	}

	if v, ok := a["updatedAt"]; ok {
		updatedAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			pdModel.UpdatedAt = time.Unix(0, updatedAt)
		}
	}

	if v, ok := a["createdBy"]; ok {
		createdBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			pdModel.CreatedBy = createdBy
		}
	}

	if v, ok := a["createdAt"]; ok {
		createdAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			pdModel.CreatedAt = time.Unix(0, createdAt)
		}
	}

	if v, ok := a["timeSettings"]; ok {
		ts := &publicdashboardModels.TimeSettings{}
		err = ts.FromDB([]byte(v))
		if err != nil {
			return err
		}
		pdModel.TimeSettings = ts
	}

	return nil
}

// toUnstructured converts a PublicDashboard to an *unstructured.Unstructured.
func k8sObjectToUnstructured(obj *PublicDashboard) (*unstructured.Unstructured, error) {
	p := obj.Base

	out, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&p)
	if err != nil {
		return nil, err
	}

	return &unstructured.Unstructured{
		Object: out,
	}, nil
}
