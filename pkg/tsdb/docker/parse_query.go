package docker

import (
    "encoding/json"
    "fmt"

    "github.com/grafana/grafana-plugin-sdk-go/backend"
)

func parseQuery(query backend.DataQuery) (*DockerQuery, error) {
    var dq DockerQuery
    if err := json.Unmarshal(query.JSON, &dq); err != nil {
        return nil, fmt.Errorf("parsing query JSON: %w", err)
    }

    switch dq.ResourceType {
    case "":
        return nil, fmt.Errorf("resourceType is required")
    case ResourceTypeContainerStats:
        if dq.ContainerID == "" {
            return nil, fmt.Errorf("containerId is required for %s", ResourceTypeContainerStats)
        }
    case ResourceTypeSystemDF:
		// nothing to be verified
    case ResourceTypeAllContainersInfo:
		// nothing to be verified
    default:
        return nil, fmt.Errorf("unknown resourceType: %s", dq.ResourceType)
    }

    return &dq, nil
}


func parseQueryRaw(raw json.RawMessage) (*DockerQuery, error) {
    var q DockerQuery
    if err := json.Unmarshal(raw, &q); err != nil {
        return nil, backend.DownstreamError(fmt.Errorf("failed to parse query model: %w", err))
    }
    return &q, nil
}
