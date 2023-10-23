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

Add etcd server to `custom.ini`:

```ini
[grafana-apiserver]
etcd_servers = 127.0.0.1:2379
```

### `kubectl` access

From the root of the Grafanaa repository, run the following:
```bash
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
kubectl api-resources
```

### Grafana API Access

The Kubernetes compatible API can be accessed using existing Grafana AuthN at: [http://localhost:3000/apis](http://localhost:3000/apis).
