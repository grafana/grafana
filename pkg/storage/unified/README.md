
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
grafanaAPIServerWithExperimentalAPIs = true
kubernetesClientDashboardsFolders = true

[unified_storage.folders.folder.grafana.app]
dualWriterMode = 4

[unified_storage.dashboards.dashboard.grafana.app]
dualWriterMode = 4

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
apiVersion: folder.grafana.app/v1beta1
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

## Setting up search
To enable it, add the following to your `custom.ini` under the `[feature_toggles]` section:
```ini
[feature_toggles]
; Used by the Grafana instance
unifiedStorageSearchUI = true
kubernetesClientDashboardsFolders = true

; Used by unified storage
unifiedStorageSearch = true
; (optional) Allows you to sort dashboards by usage insights fields when using enterprise
; unifiedStorageSearchSprinkles = true
; (optional) Will skip search results filter based on user permissions
; unifiedStorageSearchPermissionFiltering = false
```

The dashboard search page has been set up to search unified storage. Additionally, all legacy search calls (e.g. `/api/search`) will go to
unified storage when the dual writer mode is set to 3 or greater. When <= 2, the legacy search api calls will go to legacy storage.

## Running load tests
Load tests and instructions can be found [here](https://github.com/grafana/grafana-api-tests/tree/main/simulation/src/unified_storage).

## Running with a distributor

For this deployment model, the storage-api server establishes a consistent hashing ring to distribute tenant requests. The distributor serves as the primary request router, mapping incoming traffic to the appropriate storage-api server based on tenant ID. When testing functionalities reliant on this sharded persistence layer, the following steps are mandatory.

### 0. Update your network interface to allow processes to bind to localhost addresses

For this setup to work, we need to have more than one instance of `storage-api` and at least one instance of
`distributor` service. This step is a requirement for MacOS, as it by default will only allow processes to bind to `127.0.0.1` and not
`127.0.0.2`.

Run the command below in your terminal for every IP you want to enable:

```sh
sudo ifconfig lo0 alias <ip> up
```

### 1. Start MySQL DB

The storage server doesn't support `sqlite` so we need to have a dedicated external database. You can start one with
docker in case you don't have one:

```sh
docker run -d --name db -e "MYSQL_DATABASE=grafana" -e "MYSQL_USER=grafana" -e "MYSQL_PASSWORD=grafana" -e "MYSQL_ROOT_PASSWORD=root" -p 3306:3306 docker.io/bitnami/mysql:8.0.31
```

### 2. Create dedicated ini files for every service

Example distributor ini file:

* Bind grpc/http server to `127.0.0.1`
* Bind and join `memberlist` on `127.0.0.1:7946` (default memberlist port)

```ini
target = distributor

[server]
http_port = 3000
http_addr = "127.0.0.1"

[grpc_server]
network = "tcp"
address = "127.0.0.1:10000"

[grafana-apiserver]
storage_type = unified

[grpc_server_authentication]
signing_keys_url = http://localhost:3011/api/signing-keys/keys
mode = "on-prem"

[unified_storage]
enable_sharding = true
memberlist_bind_addr = "127.0.0.1"
memberlist_advertise_addr = "127.0.0.1"
memberlist_join_member = "127.0.0.1:7946"
```

Example unified storage ini file:

* Bind grpc/http server to `127.0.0.2`
* Configue MySQL database parameters
* Enable a few feature flags
* Give it a unique `instance_id` (defaults to hostname, so you need to define it locally)
* Bind `memberlist` to `127.0.0.2` and join the member on `127.0.0.1` (the distributor module above)

You can repeat the same configuration for many different storage-api instances by changing the bind address
from `127.0.0.2` to something else, eg `127.0.0.3`

```ini
target = storage-server

[server]
http_port = 3000
http_addr = "127.0.0.2"

[resource_api]
db_type = mysql
db_host = localhost:3306
db_name = grafana ; or whatever you defined in your currently running database
db_user = grafana ; or whatever you defined in your currently running database
db_pass = grafana ; or whatever you defined in your currently running database

[grpc_server]
network = "tcp"
address = "127.0.0.2:10000"

[grafana-apiserver]
storage_type = unified

[grpc_server_authentication]
signing_keys_url = http://localhost:3011/api/signing-keys/keys
mode = "on-prem"

[feature_toggles]
kubernetesClientDashboardsFolders = true
kubernetesDashboardsAPI = true
kubernetesFolders = true
unifiedStorage = true
unifiedStorageSearch = true

[unified_storage]
enable_sharding = true
instance_id = node-0
memberlist_bind_addr = "127.0.0.2"
memberlist_advertise_addr = "127.0.0.2"
memberlist_join_member = "127.0.0.1:7946"
```

Example grafana ini file:

* Bind http server to `127.0.0.2`.
* Explicitly declare the sqlite db. This is so when you run a second instance they don't both try to use the same sqlite
  file.
* Configure the storage api client to talk to the distributor on `127.0.0.1:10000`
* Configure feature flags/modes as desired

Then repeat this configuration and change:

* the `stack_id` to something unique
* the database
* the bind address (so the browser can save the auth for every instance in a different cookie)
```ini
target = all

[environment]
stack_id = 1

[database]
type = sqlite3
name = grafana
user = root
path = grafana1.db

[grafana-apiserver]
address = 127.0.0.1:10000
storage_type = unified-grpc

[server]
protocol = http
http_port = 3011
http_addr = "127.0.0.2"

[feature_toggles]
kubernetesClientDashboardsFolders = true
kubernetesDashboardsAPI = true
kubernetesFolders = true
unifiedStorageSearchUI = true

[unified_storage.dashboards.dashboard.grafana.app]
dualWriterMode = 3
[unified_storage.folders.folder.grafana.app]
dualWriterMode = 3
[unified_storage.playlists.playlist.grafana.app]
dualWriterMode = 4
```

### 3. Run the services

Build the backend:

```sh
GO_BUILD_DEV=1 make build-go
```

You will need a separate process for every service. It's the same command with a separate `ini` file to it. For
example, if you created a `distributor.ini` file in the `conf` directory, this is how you would run the distributor:

```sh
./bin/grafana server target --config conf/distributor.ini
```

Repeat for the other services.

```sh
./bin/grafana server target --config conf/storage-api-1.ini
./bin/grafana server target --config conf/storage-api-2.ini
./bin/grafana server target --config conf/storage-api-3.ini

./bin/grafana server target --config conf/grafana1.ini
./bin/grafana server target --config conf/grafana2.ini
./bin/grafana server target --config conf/grafana3.ini
```

etc

### 4. Verify that it is working

If all is well, you will be able to visit every grafana stack you started and use it normally. Visit
`http://127.0.0.2:3011`, login with `admin`/`admin`, create some dashboards/folders, etc.

For debugging purposes, you can view the memberlist status by visitting `http://127.0.0.1:3000/memberlist` and check
that every instance you create is part of the memberlist.
You can also visit `http://127.0.0.1:3000/ring` to view the ring status and the storage-api servers that are part of the
ring.
