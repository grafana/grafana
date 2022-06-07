package api

import (
	"net/http"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/pkg/encoding/json"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/thema/encoding/jsonschema"
)

func (hs *HTTPServer) GetDashboardSchema(c *models.ReqContext) response.Response {
	dcm := hs.CoremodelStaticRegistry.Dashboard()
	f, err := jsonschema.GenerateSchema(dcm.CurrentSchema())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to generate dashboard schema", err)
	}

	// TODO do this directly in Thema
	f.Decls = append(f.Decls, &ast.Field{
		Label: ast.NewString("$ref"),
		Value: ast.NewString("#/components/schemas/dashboard"),
	})
	j, err := cuejson.Marshal(cuecontext.New().BuildFile(f))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed marshaling schema to json", err)
	}

	return response.JSON(http.StatusOK, j)
}

func (hs *HTTPServer) GetPanelSchema(c *models.ReqContext) response.Response {
	dcm := hs.CoremodelStaticRegistry.Dashboard()
	f, err := jsonschema.GenerateSchema(dcm.CurrentSchema())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to generate dashboard schema", err)
	}

	// Doing it this way is hacky, but as long as the definition of panels is
	// embedded within dashboards, there's no easy way around it.
	f.Decls = append(f.Decls, &ast.Field{
		Label: ast.NewString("$ref"),
		Value: ast.NewString("#/components/schemas/dashboard.Panel"),
	})
	j, err := cuejson.Marshal(cuecontext.New().BuildFile(f))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed marshaling schema to json", err)
	}

	return response.JSON(http.StatusOK, j)
}
