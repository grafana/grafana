package docker

import (
    "context"

    "github.com/moby/moby/client"
)

type fakeDockerClient struct {
    statsResult client.ContainerStatsResult
    statsErr    error

    diskUsage client.DiskUsageResult
    diskErr   error

    containerList client.ContainerListResult
    listErr       error
}

func (f *fakeDockerClient) ContainerStats(_ context.Context, _ string, _ client.ContainerStatsOptions) (client.ContainerStatsResult, error) {
    return f.statsResult, f.statsErr
}

func (f *fakeDockerClient) DiskUsage(_ context.Context, _ client.DiskUsageOptions) (client.DiskUsageResult, error) {
    return f.diskUsage, f.diskErr
}

func (f *fakeDockerClient) ContainerList(_ context.Context, _ client.ContainerListOptions) (client.ContainerListResult, error) {
    return f.containerList, f.listErr
}
