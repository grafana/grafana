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

* [the staging folder](https://github.com/kubernetes/kubernetes/tree/master/staging/src/k8s.io)that is the true source of the k8s repos linked below. this is useful when tracing the source of k8s code because GitHub is able to follow where types are coming from in the Kubernetes monorepo
* [apimachinery](https://github.com/kubernetes/apimachinery) == [pkg/apimachinery](/pkg/apimachinery) - contains types and utils that are used by both API clients and servers
* [apiserver](https://github.com/kubernetes/apiserver) == [pkg/apiserver](/pkg/apiserver) - contains apiserver library code used for both standalone app apiservers and the one embedded in grafana. it depends on `pkg/apimachinery`
* [pkg/services/apiserver](/pkg/services/apiserver) - this is where the embedded grafana API server background service is currently configured. it depends on `pkg/apiserver` and `pkg/apimachinery`
* [pkg/apis](/pkg/apis) - where API resource types are defined
* [hack/update-codegen.sh](/hack#kubernetes-hack-alert) - the script used to run [k8s codegen](https://github.com/kubernetes/code-generator/) against the types defined in `pkg/apis`
* [pkg/registry/apis](/pkg/registry/apis) - where all of the types in `pkg/apis` are registered with the API server by implementing the [builder](/pkg/apiserver/builder/common.go#L18) interface
* [pkg/cmd/grafana/apiserver](/pkg/cmd/grafana/apiserver) - this is where the apiserver is configured for the `grafana apiserver` CLI command, which can be used to launch standalone API servers