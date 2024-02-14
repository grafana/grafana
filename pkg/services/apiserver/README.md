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
