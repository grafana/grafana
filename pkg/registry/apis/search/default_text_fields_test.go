package search

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

func TestHandlerDefaultTextFields(t *testing.T) {
	for _, tc := range []struct {
		name, where    string
		defaults, want []string
	}{
		{name: "existing default", where: `{"text":{"value":"cpu"}}`, want: []string{"title"}},
		{name: "kind default", where: `{"text":{"value":"cpu"}}`, defaults: []string{"title", "description"}, want: []string{"title", "description"}},
		{name: "explicit fields", where: `{"text":{"value":"cpu","fields":["title"]}}`, defaults: []string{"title", "description"}, want: []string{"title"}},
		{name: "conjunction", where: `{"and":[{"text":{"value":"cpu"}},{"filter":{"field":"tags","operator":"In","values":["production"]}}]}`, defaults: []string{"title", "description"}, want: []string{"title", "description"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeIndexClient{resp: emptyResponse()}
			handler := NewHandlerWithOptions(client, testProvider(), noop.NewTracerProvider().Tracer(""), HandlerOptions{DefaultTextFields: tc.defaults})
			w := doRequest(t, handler, `{"apiVersion":"`+searchv0.APIVERSION+`","kind":"SearchQuery","where":`+tc.where+`}`)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			fields := []string{}
			for _, field := range client.got.QueryFields {
				fields = append(fields, field.Name)
			}
			require.Equal(t, tc.want, fields)
		})
	}
}
