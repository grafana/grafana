# Grafana Kubernetes compatible API Server

## Basic Setup

```ini
app_mode = development

[feature_toggles]
grafanaAPIServer = true
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

### `kubectl` access

From the root of the Grafanaa repository, run the following:
```bash
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
kubectl api-resources
```

### Grafana API Access

The Kubernetes compatible API can be accessed using existing Grafana AuthN at: [http://localhost:3000/apis](http://localhost:3000/apis).
