package query

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

func (b *QueryAPIBuilder) handleQuery(w http.ResponseWriter, r *http.Request) {
	reqDTO := v0alpha1.QueryRequest{}
	if err := web.Bind(r, &reqDTO); err != nil {
		_, _ = w.Write([]byte("bad request"))
		return
	}

	// TODO... actually query
	rsp := &backend.QueryDataResponse{
		Responses: backend.Responses{
			"A": backend.DataResponse{
				Frames: data.Frames{
					&data.Frame{
						Meta: &data.FrameMeta{
							Custom: map[string]any{
								"TODO": reqDTO,
							},
						},
					},
				},
				Error: fmt.Errorf("not implemented yet"),
			},
		},
	}

	// TODO: accept headers for protobuf
	if false {
		proto, _ := backend.ConvertToProtobuf{}.QueryDataResponse(rsp)
		_, _ = w.Write([]byte(proto.String())) // ???
	}

	data, _ := json.MarshalIndent(rsp, "", "  ")
	_, _ = w.Write(data)
}
