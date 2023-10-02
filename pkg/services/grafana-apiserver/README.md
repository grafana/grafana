# Grafana Kubernetes compatible API Server

## Basic Setup

```ini
app_mode = development

[feature_toggles]
grafanaAPIServer = true
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

Enable dual write to `etcd`:

```ini
[grafana-apiserver]
etcd_servers = 127.0.0.1:2379
```

### `kubectl` access

From the root of the repository:

```bash
export KUBECONFIG=$PWD/data/k8s/grafana.kubeconfig
kubectl api-resources
```

### Grafana API Access

The Kubernetes compatible API can be accessed using existing Grafana AuthN at: [http://localhost:3000/k8s/apis/](http://localhost:3000/k8s/apis/).
