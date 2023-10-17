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

1. `kubectl` requires HTTPS, so you will need to [configure and enable HTTPS](https://grafana.com/docs/grafana/latest/setup-grafana/set-up-https/) in `custom.ini`.
1. Create a service account token: http://localhost:3000/org/serviceaccounts
1. Edit `data/grafana-apiserver/grafana.kubeconfig` and replace the token placeholder with the service account token created in the previous step.
1. From the root of the Grafanaa repository, run the following:
```bash
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
kubectl api-resources
```

### Grafana API Access

The Kubernetes compatible API can be accessed using existing Grafana AuthN at: [http://localhost:3000/apis](http://localhost:3000/apis).
