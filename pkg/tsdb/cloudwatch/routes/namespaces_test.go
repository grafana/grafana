package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func Test_Namespaces_Route(t *testing.T) {
	customNamespaces := ""
	factoryFunc := func(pluginCtx backend.PluginContext, region string) (reqCtx models.RequestContext, err error) {
		return models.RequestContext{
			Settings: models.CloudWatchSettings{
				Namespace: customNamespaces,
			},
		}, nil
	}

	t.Run("calls GetHardCodedNamespaces", func(t *testing.T) {
		origGetHardCodedNamespaces := services.GetHardCodedNamespaces
		t.Cleanup(func() {
			services.GetHardCodedNamespaces = origGetHardCodedNamespaces
		})
		haveBeenCalled := false
		services.GetHardCodedNamespaces = func() []resources.ResourceResponse[string] {
			haveBeenCalled = true
			return []resources.ResourceResponse[string]{}
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/namespaces", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(NamespacesHandler, logger, factoryFunc))
		handler.ServeHTTP(rr, req)
		assert.True(t, haveBeenCalled)
	})

	t.Run("returns merges hardcoded namespaces and custom namespaces", func(t *testing.T) {
		origGetHardCodedNamespaces := services.GetHardCodedNamespaces
		t.Cleanup(func() {
			services.GetHardCodedNamespaces = origGetHardCodedNamespaces
		})
		services.GetHardCodedNamespaces = func() []resources.ResourceResponse[string] {
			return []resources.ResourceResponse[string]{{Value: "AWS/EC2"}, {Value: "AWS/ELB"}}
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/namespaces", nil)
		customNamespaces = "customNamespace1,customNamespace2"
		handler := http.HandlerFunc(ResourceRequestMiddleware(NamespacesHandler, logger, factoryFunc))
		handler.ServeHTTP(rr, req)
		assert.JSONEq(t, `[{"value":"AWS/EC2"}, {"value":"AWS/ELB"}, {"value":"customNamespace1"}, {"value":"customNamespace2"}]`, rr.Body.String())
	})

	t.Run("sorts result", func(t *testing.T) {
		origGetHardCodedNamespaces := services.GetHardCodedNamespaces
		t.Cleanup(func() {
			services.GetHardCodedNamespaces = origGetHardCodedNamespaces
		})
		services.GetHardCodedNamespaces = func() []resources.ResourceResponse[string] {
			return []resources.ResourceResponse[string]{{Value: "AWS/XYZ"}, {Value: "AWS/ELB"}}
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/namespaces", nil)
		customNamespaces = "DCustomNamespace1,ACustomNamespace2"
		handler := http.HandlerFunc(ResourceRequestMiddleware(NamespacesHandler, logger, factoryFunc))
		handler.ServeHTTP(rr, req)
		assert.JSONEq(t, `[{"value":"ACustomNamespace2"}, {"value":"AWS/ELB"}, {"value":"AWS/XYZ"}, {"value":"DCustomNamespace1"}]`, rr.Body.String())
	})
}
