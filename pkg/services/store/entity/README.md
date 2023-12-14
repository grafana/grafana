# Unified Storage

The unified storage projects aims to provide a simple and extensible backend to unify the way we store different objects within the Grafana app platform.

It provides generic storage for k8s objects, and can store data either within dedicated tables in the main Grafana database, or in separate storage.

By default it runs in-process within Grafana, but it can also be run as a standalone GRPC service (`storage-server`).

## Storage Overview

There are 2 main tables, the `entity` table stores a "current" view of the objects, and the `entity_history` table stores a record of each revision of a given object.

## Running Unified Storage

### Baseline configuration

The minimum config settings required are:

```ini
; dev mode is required
app_mode = development
; need to specify target here for override to work later
target = all

[server]
; https is required for kubectl
protocol = https

[feature_toggles]
; enable unified storage
unifiedStorage = true
; enable k8s apiserver
grafanaAPIServer = true
; store playlists in k8s
kubernetesPlaylists = true
; store json id token in context
idForwarding = true

[grafana-apiserver]
; use unified storage for k8s apiserver
storage_type = unified
```

With this configuration, you can run everything in-process with:

```sh
bra run
```

The default kubeconfig sends requests directly to the apiserver, to authenticate as a grafana user, create `grafana.kubeconfig`:
```yaml
apiVersion: v1
clusters:
- cluster:
    insecure-skip-tls-verify: true
    server: https://127.0.0.1:3000
  name: default-cluster
contexts:
- context:
    cluster: default-cluster
    namespace: default
    user: default
  name: default-context
current-context: default-context
kind: Config
preferences: {}
users:
- name: default
  user:
    username: <username>
    password: <password>
```
Where `<username>` and `<password>` are credentials for basic auth against Grafana.

In this mode, you can interact with the k8s api via:
```sh
kubectl --kubeconfig=./grafana.kubeconfig get playlist
```

To create a playlist, create a file `playlist-generate.yaml`:
```yaml
apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
metadata:
  generateName: x # anything is ok here... except yes or true -- they become boolean!
  labels:
    foo: bar
spec:
  title: Playlist with auto generated UID
  interval: 5m
  items:
  - type: dashboard_by_tag
    value: panel-tests
  - type: dashboard_by_uid
    value: vmie2cmWz # dashboard from devenv
```
then run:
```sh
kubectl --kubeconfig=./grafana.kubeconfig create -f playlist-generate.yaml
```

### Use a separate database

To run against a separate database, update custom.ini:

```
[entity_api]
db_type = mysql
db_host = localhost:3306
db_name = grafana
db_user = grafanauser
db_pass = grafanapass
```

MySQL and Postgres are both supported.

### Run as a GRPC service

#### Start GRPC storage-server

This currently only works with a separate database configuration (see previous section).

Start the storage-server with:
```sh
GF_DEFAULT_TARGET=storage-server ./bin/grafana server target
```

The GRPC service will listen on port 10000

#### Use GRPC server

To run grafana against the storage-server, override the `storage_type` setting:
```sh
GF_GRAFANA_APISERVER_STORAGE_TYPE=unified-grpc ./bin/grafana server
```

You can then list the previously-created playlists with:
```sh
kubectl --kubeconfig=./grafana.kubeconfig get playlist
```