
# Unified Storage

The unified storage projects aims to provide a simple and extensible backend to unify the way we store different objects within the Grafana app platform.

It provides generic storage for k8s objects, and can store data either within dedicated tables in the main Grafana database, or in separate storage.

By default it runs in-process within Grafana, but it can also be run as a standalone GRPC service (`storage-server`).

## Storage Overview

There are 2 main tables, the `resource` table stores a "current" view of the objects, and the `resource_history` table stores a record of each revision of a given object.

## Running Unified Storage

### Playlists: baseline configuration

The minimum config settings required are:

```ini
; need to specify target here for override to work later
target = all

[server]
; https is required for kubectl
protocol = https

[feature_toggles]
; store playlists in k8s
kubernetesPlaylists = true

[grafana-apiserver]
; use unified storage for k8s apiserver
storage_type = unified

# Dualwriter modes
# 0: disabled (default mode)
# 1: read from legacy, write to legacy, write to unified best-effort
# 2: read from legacy, write to both
# 3: read from unified, write to both
# 4: read from unified, write to unified
# 5: read from unified, write to unified, ignore background sync state
[unified_storage.playlists.playlist.grafana.app]
dualWriterMode = 0
```

**Note**: When using the Dualwriter, Watch will only work with mode 5.

### Folders: baseline configuration

NOTE: allowing folders to be backed by Unified Storage is under development and so are these instructions. 

The minimum config settings required are:

```ini
; need to specify target here for override to work later
target = all

[server]
; https is required for kubectl
protocol = https

[feature_toggles]
; store folders in k8s
kubernetesFolders = true
grafanaAPIServerWithExperimentalAPIs = true

[grafana-apiserver]
; use unified storage for k8s apiserver
storage_type = unified
```

### Setting up a kubeconfig 

With this configuration, you can run everything in-process. Run the Grafana backend with:

```sh
bra run
```

or

```sh
make run
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
Where `<username>` and `<password>` are credentials for basic auth against Grafana. For example, with the [default credentials](https://github.com/grafana/grafana/blob/HEAD/contribute/developer-guide.md#backend):
```yaml
    username: admin
    password: admin
```

### Playlists: interacting with the k8s API

In this mode, you can interact with the k8s api. Make sure you are in the directory where you created `grafana.kubeconfig`. Then run:
```sh
kubectl --kubeconfig=./grafana.kubeconfig get playlist
```

If this is your first time running the command, a successful response would be:
```sh
No resources found in default namespace.
```

To create a playlist, create a file `playlist-generate.yaml`:
```yaml
apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
metadata:
  generateName: x # anything is ok here... except yes or true -- they become boolean!
  labels:
    foo: bar
  annotations:
    grafana.app/slug: "slugger"
    grafana.app/updatedBy: "updater"
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

For example, a successful response would be:
```sh
playlist.playlist.grafana.app/u394j4d3-s63j-2d74-g8hf-958773jtybf2 created
```

When running
```sh
kubectl --kubeconfig=./grafana.kubeconfig get playlist
```
you should now see something like:
```sh
NAME                                   TITLE                              INTERVAL   CREATED AT
u394j4d3-s63j-2d74-g8hf-958773jtybf2   Playlist with auto generated UID   5m         2023-12-14T13:53:35Z 
```

To update the playlist, update the `playlist-generate.yaml` file then run:
```sh
kubectl --kubeconfig=./grafana.kubeconfig patch playlist <NAME> --patch-file playlist-generate.yaml
```

In the example, `<NAME>` would be `u394j4d3-s63j-2d74-g8hf-958773jtybf2`.

### Folders: interacting with the k8s API

Make sure you are in the directory where you created `grafana.kubeconfig`. Then run:
```sh
kubectl --kubeconfig=./grafana.kubeconfig get folder
```

If this is your first time running the command, a successful response would be:
```sh
No resources found in default namespace.
```

To create a folder, create a file `folder-generate.yaml`:
```yaml
apiVersion: folder.grafana.app/v0alpha1
kind: Folder
metadata:
  generateName: x # anything is ok here... except yes or true -- they become boolean!
spec:
  title: Example folder
```
then run:
```sh
kubectl --kubeconfig=./grafana.kubeconfig create -f folder-generate.yaml
```

### Use a separate database

By default Unified Storage uses the Grafana database. To run against a separate database, update `custom.ini` by adding the following section to it:

```
[resource_api]
db_type = mysql
db_host = localhost:3306
db_name = grafana
db_user = <username>
db_pass = <password>
```

MySQL and Postgres are both supported. The `<username>` and `<password>` values can be found in the following devenv docker compose files: [MySQL](https://github.com/grafana/grafana/blob/main/devenv/docker/blocks/mysql/docker-compose.yaml#L6-L7) and [Postgres](https://github.com/grafana/grafana/blob/main/devenv/docker/blocks/postgres/docker-compose.yaml#L4-L5).

Then, run
```sh
make devenv sources=<source>
```
where source is either `mysql` or `postgres`.

Finally, run the Grafana backend with

```sh
bra run
```
or
```sh
make run
```

### Run as a GRPC service

#### Start GRPC storage-server

Make sure you have the gRPC address in the `[grafana-apiserver]` section of your config file:
```ini
[grafana-apiserver]
; your gRPC server address
address = localhost:10000
```

You also need the `[grpc_server_authentication]` section to authenticate incoming requests:
```ini
[grpc_server_authentication]
; http url to Grafana's signing keys to validate incoming id tokens
signing_keys_url = http://localhost:3000/api/signing-keys/keys
mode = "on-prem"
```

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

## Changing protobuf interface

- install [protoc](https://grpc.io/docs/protoc-installation/)
- install the protocol compiler plugin for Go
```sh
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```
- make changes in `.proto` file
- to compile all protobuf files in the repository run `make protobuf` at its top level

## Setting up search (EXPERIMENTAL)
Unified storage now exposes an **experimental** search API. It can be used to search for specific resources, or to filter/query resources. 
To enable it, add the following to your `custom.ini` under the `[feature_toggles]` section:
```ini
[feature_toggles]
unifiedStorageSearch = true
```

To access the api through Grafana, go to Explore -> Query Type -> Search.

The query needs to be a valid [Bleve query string](https://blevesearch.com/docs/Query-String-Query/).

Some example queries are:
- `*` - returns all objects
- `Kind:Playlist` - returns all playlists
- `Spec.inveral:5m` - returns all objects with the spec.inverval field set to 5m
- `+Kind:Playlist +Spec.title:p4` - returns all playlists with the title matching "p4"
- `*foo*` - returns all objects containing "foo" in any field
- `CreatedAt:>="2024-10-17"` - returns all objects created after 2024-10-17
- `+CreatedAt:>="2024-10-17" +Kind:Playlist` - returns all playlists created after 2024-10-17
