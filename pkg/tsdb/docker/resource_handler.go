package docker

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"

    "github.com/grafana/grafana-plugin-sdk-go/backend"
    "github.com/moby/moby/client"
)


type resourceHandler[T any] func(ctx context.Context, dsInfo *datasourceInfo, body *T) ([]byte, int, error)


func (s *Service) newResourceMux() *http.ServeMux {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /containers", handleResourceReq(s.handleListContainers, s))
    return mux
}


func handleResourceReq[T any](handlerFn resourceHandler[T], s *Service) func(rw http.ResponseWriter, req *http.Request) {
    return func(rw http.ResponseWriter, req *http.Request) {
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)
		
        pluginCtx := backend.PluginConfigFromContext(req.Context())
        ctx := req.Context()
        dsInfo, err := s.getDSInfo(ctx, pluginCtx)
        if err != nil {
            writeErrorResponse(rw, http.StatusInternalServerError, err.Error())
            return
        }

		defer func() {
			if req.Body != nil {
				if err := req.Body.Close(); err != nil {
					s.logger.Warn("Failed to close request body", "err", err)
					writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
					return
				}
			}
		}()

        var parsedBody *T
        if req.Body != nil {
            body, _ := io.ReadAll(req.Body)
            if len(body) > 0 {
                _ = json.Unmarshal(body, &parsedBody)
            }
        }
        response, statusCode, err := handlerFn(ctx, dsInfo, parsedBody)
        if err != nil {
            writeErrorResponse(rw, statusCode, err.Error())
            return
        }

        rw.Header().Set("Content-Type", "application/json")
        rw.WriteHeader(statusCode)
        _, err = rw.Write(response)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("failed to write response: %v", err))
			return
		}
    }
}

func writeErrorResponse(rw http.ResponseWriter, code int, msg string) {
    rw.Header().Set("Content-Type", "application/json")
    rw.WriteHeader(code)
    errorBody := map[string]string{"error": msg}
    jsonRes, _ := json.Marshal(errorBody)
    _, err := rw.Write(jsonRes)
	if err != nil {
		backend.Logger.Error("Unable to write HTTP response", "error", err)
	}
}


func (s *Service) handleListContainers(ctx context.Context, dsInfo *datasourceInfo, body *any) ([]byte, int, error) {
    containers, err := dsInfo.API.cli.ContainerList(ctx, client.ContainerListOptions{
        All: true,
    })
    if err != nil {
        return nil, http.StatusBadGateway, fmt.Errorf("listing containers: %w", err)
    }

    out := make([]GetContainers, 0, len(containers.Items))
    for _, c := range containers.Items {
        out = append(out, GetContainers{
            Id:    c.ID,
            Names: c.Names,
        })
    }
    response, err := json.Marshal(out)
    if err != nil {
        return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal containers response: %w", err)
    }

    return response, http.StatusOK, nil
}
