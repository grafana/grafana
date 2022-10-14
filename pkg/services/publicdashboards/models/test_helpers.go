package models

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func AddAnnotationsToDashboard(t *testing.T, dash *models.Dashboard, annotations []DashAnnotation) *models.Dashboard {
	type annotationsDto struct {
		List []DashAnnotation `json:"list"`
	}
	annos := annotationsDto{}
	annos.List = annotations
	annoJSON, err := json.Marshal(annos)
	require.NoError(t, err)

	dashAnnos, err := simplejson.NewJson(annoJSON)
	require.NoError(t, err)

	dash.Data.Set("annotations", dashAnnos)

	return dash
}
