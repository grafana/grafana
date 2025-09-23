# Grafana Kubernetes compatible API Server

## Basic Setup

```ini
[feature_toggles]
kubernetesPlaylists = true
```

Start Grafana:

```bash
make run
```

## Enable dual write to `etcd`

Start `etcd`:
```bash
make devenv sources=etcd
```

Set storage type and etcd server address in `custom.ini`:

```ini
[grafana-apiserver]
storage_type = etcd
etcd_servers = 127.0.0.1:2379
```

## Enable dual write to JSON files:

Set storage type:

```ini
[grafana-apiserver]
storage_type = file
```

Objects will be written to disk under the `{data.path}/grafana-apiserver/` directory.

For example:

```
data/grafana-apiserver
├── grafana.kubeconfig
└── playlist.grafana.app
    └── playlists
        └── default
            └── hi.json
```

## Enable aggregation

See [aggregator/README.md](./aggregator/README.md) for more information.

### `kubectl` access

For kubectl to work, grafana needs to run over https.  To simplify development, you can use:

```ini
app_mode = development

[feature_toggles]
grafanaAPIServerEnsureKubectlAccess = true
kubernetesPlaylists = true

[unified_storage.playlists.playlist.grafana.app]
dualWriterMode = 2
dualWriterPeriodicDataSyncJobEnabled = true
```

This will create a development kubeconfig and start a parallel ssl listener.  It can be registered by
navigating to the root grafana folder, then running:
```bash
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
kubectl api-resources
```

### Grafana API Access

The Kubernetes compatible API can be accessed using existing Grafana AuthN at: [http://localhost:3000/apis](http://localhost:3000/apis).

The equivalent openapi docs can be seen in [http://localhost:3000/swagger](http://localhost:3000/swagger), 
select the relevant API from the dropdown in the upper right.

## General Structure

The folder structure aims to follow the patterns established in standard (https://github.com/kubernetes/kubernetes)[kubernetes] projects when possible.

* [pkg/apimachinery](/pkg/apimachinery) - this is based on the structure of [apimachinery](https://github.com/kubernetes/apimachinery). it contains types and utils that are used by both API clients and servers
* [pkg/apiserver](/pkg/apiserver) - this is based on the structure of [apiserver](https://github.com/kubernetes/apiserver). it contains apiserver library code used for both standalone app apiservers and the one embedded in grafana. it depends on `pkg/apimachinery`
* [pkg/services/apiserver](/pkg/services/apiserver) - this is where the embedded grafana API server background service is currently configured. it depends on `pkg/apiserver` and `pkg/apimachinery`. the closest analog in the Kubernetes monorepo is the [kube-apiserver cmd](https://github.com/kubernetes/kubernetes/tree/master/cmd/kube-apiserver/app).
* [pkg/apis](/pkg/apis) - where API resource types are defined. this is based on the structure of the [sample-apiserver](https://github.com/kubernetes/sample-apiserver/tree/master/pkg/apis)
* [hack/update-codegen.sh](/hack#kubernetes-hack-alert) - this script is used to run [k8s codegen](https://github.com/kubernetes/code-generator/), which generates the code that is used by the API server to handle the types defined in `pkg/apis`. it is based on the [update-codegen.sh from sample-apiserver](https://github.com/kubernetes/sample-apiserver/blob/master/hack/update-codegen.sh)
* [pkg/registry/apis](/pkg/registry/apis) - where all of the types in `pkg/apis` are registered with the API server by implementing the [builder](/pkg/services/apiserver/builder/common.go#L18) interface. this pattern is unique to grafana, and is needed to support using wire dependencies in legacy storage implementations. this is separated from `pkg/apis` to avoid issues with k8s codegen.
* [pkg/cmd/grafana/apiserver](/pkg/cmd/grafana/apiserver) - this is where the apiserver is configured for the `grafana apiserver` CLI command, which can be used to launch standalone API servers. this will eventually be merged with the config in `pkg/services/apiserver` to reduce duplication.
