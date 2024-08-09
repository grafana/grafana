package apiserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"

	"github.com/emicklei/go-restful/v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	genericapiserver "k8s.io/apiserver/pkg/server"

	aggregationv0alpha1api "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

var (
	discoveryGroup = metav1.APIGroup{
		Name: aggregationv0alpha1api.SchemeGroupVersion.Group,
		Versions: []metav1.GroupVersionForDiscovery{
			{
				GroupVersion: aggregationv0alpha1api.SchemeGroupVersion.String(),
				Version:      aggregationv0alpha1api.SchemeGroupVersion.Version,
			},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{
			GroupVersion: aggregationv0alpha1api.SchemeGroupVersion.String(),
			Version:      aggregationv0alpha1api.SchemeGroupVersion.Version,
		},
	}
)

// apisProxyHandler serves the `/apis` endpoint.
type apisProxyHandler struct {
	delegationTarget genericapiserver.DelegationTarget
	codecs           serializer.CodecFactory
}

func (a *apisProxyHandler) handle(req *restful.Request, resp *restful.Response, chain *restful.FilterChain) {
	if req.Request.URL.Path != "/apis" && req.Request.URL.Path != "/apis/" {
		chain.ProcessFilter(req, resp)
		return
	}

	discoveryGroupList := &metav1.APIGroupList{
		Groups: []metav1.APIGroup{discoveryGroup},
	}

	rw := httptest.NewRecorder()
	a.delegationTarget.UnprotectedHandler().ServeHTTP(rw, req.Request)

	if rw.Code != http.StatusOK {
		http.Error(resp.ResponseWriter, rw.Body.String(), rw.Code)
		return
	}

	proxiedGroups := metav1.APIGroupList{}
	if err := json.Unmarshal(rw.Body.Bytes(), &proxiedGroups); err != nil {
		http.Error(resp.ResponseWriter, err.Error(), http.StatusInternalServerError)
		return
	}

	discoveryGroupList.Groups = append(discoveryGroupList.Groups, proxiedGroups.Groups...)

	responsewriters.WriteObjectNegotiated(a.codecs, negotiation.DefaultEndpointRestrictions, schema.GroupVersion{}, resp.ResponseWriter, req.Request, http.StatusOK, discoveryGroupList, false)
}
