## Data Plane Aggregator

The data plane aggregator is a reverse proxy similar to `kube-aggregator` that sits first in the request path. It is responsible for reverse proxying any registered data plane (anything that isn't CRUD + List + Watch) routes to the appropriate app handlers. Anything that does not match the registered data planeroutes will be delegated to the next apiserver in the handler chain (e.g. `kube-aggregator`). Currently the aggregator uses the Grafana plugin framework to register and proxy requests to Grafana plugins. The benefit of this approach is that it allows apps to be built, packaged, published, and deployed using the existing Grafana plugin framework.

![Request Flow](./requestflow.png)

### Architecture

The data plane aggregator is built on top of the Kubernetes API server framework. It introduces a new `DataPlaneService` Custom Resource Definition (CRD) to dynamically register and proxy requests to Grafana plugins.

The main components are:

*   **GrafanaAggregator**: The main server component, located in `pkg/aggregator/apiserver/apiserver.go`. It's responsible for:
    *   Creating a generic API server.
    *   Registering the `DataPlaneService` resource.
    *   Running the `DataPlaneServiceRegistrationController`.
*   **DataPlaneServiceRegistrationController**: This controller, located in `pkg/aggregator/apiserver/dataplaneservice_controller.go`, is responsible for:
    *   Watching for `add`, `update`, and `delete` events on `DataPlaneService` resources.
    *   Passing the `DataPlaneService` to the `PluginHandler` to add, update, or remove the corresponding proxy handlers.
*   **PluginHandler**: This handler, located in `pkg/aggregator/apiserver/plugin/handler.go`, is responsible for:
    *   Translating between the HTTP request/response and Grafana plugin request/response.
    *   Adding and removing HTTP handlers to proxy requests to plugins based on the registered `DataPlaneService` resources.
*   **DataPlaneService**: Defined in `pkg/aggregator/apis/aggregation/v0alpha1/types.go`, this represents a service provided by a Grafana plugin.

The following diagram illustrates the request flow:

```mermaid
sequenceDiagram
    autonumber

    participant plugin as disk
    participant exe as plugin<br>binaries
    participant wrap as apiserver
    participant agg as kube-aggregator
    participant data as dataplane-aggregator
    participant storage as Unified<br>Storage

    Note over plugin,storage: Registration
    wrap->>plugin: Load Scope app manifest
    wrap->>agg: Create Scope APIService
    wrap->>plugin: Load SLO app manifest
    wrap->>agg: Create SLO APIService
    wrap->>plugin: Load Dashboard app manifest
    wrap->>agg: Create Dashboard APIService
    wrap->>data: Create Dashboard DataPlaneService

    Note over plugin,storage: Storage Access
    data->>storage: DataPlaneServices
    agg->>storage: APIServices
    wrap->>storage: Custom resources

    Note over plugin,storage: Create, Update, or Delete Hooks
    data->>agg: Local delegation to kube-aggregator
    agg->>wrap: HTTP reverse proxy incoming request
    wrap->>exe: gRPC admission mutation hook
    wrap->>exe: gRPC admission validation hook

    Note over plugin,storage: Get, List, or Watch Hooks
    data->>agg: Local delegation to kube-aggregator
    agg->>wrap: HTTP reverse proxy incoming request
    wrap->>exe: gRPC conversion hook

    Note over plugin,storage: Subresource & Custom Routes
    data->>exe: gRPC plugin resource calls
    data->>exe: gRPC plugin query data
    data->>exe: gRPC plugin stream
    data->>exe: gRPC plugin health
    data->>exe: gRPC plugin metrics

    Note over plugin,storage: Async (controllers)
    exe->>data: Watch
    data->>agg: Local delegation to kube-aggregator
    agg->>wrap: HTTP reverse proxy incoming request
    wrap->>storage: Watch
```

## DataPlaneService

A `DataPlaneService` is a non-namespaced resource that represents a service exposed by a Grafana plugin. Here is an example:

```yaml
apiVersion: aggregation.grafana.app/v0alpha1
kind: DataPlaneService
metadata:
  name: <plugin-id>
spec:
  pluginID: <plugin-id>
  pluginType: <plugin-type> # app or datasource
  group: <api-group>
  version: <api-version>
  services:
    - type: <service-type> # admission, conversion, query, stream, route, datasource-proxy
      method: <http-method>
      path: <url-path>
```

### Query Example

1. `custom.ini` changes:
```ini
[feature_toggles]
kubernetesAggregator = true
dataplaneAggregator = true
grafanaAPIServerEnsureKubectlAccess = true
```

2. start grafana:
```bash
make run
```

3. enable aggregation for prometheus data source:
```bash
export KUBECONFIG=./data/grafana-apiserver/grafana.kubeconfig
kubectl apply -f pkg/aggregator/examples/datasource.yml --validate=false
dataplaneservice.aggregation.grafana.app/v0alpha1.prometheus.grafana.app created
```

4. edit `pkg/aggregator/examples/datasource-query.json` and update the datasource UID to match the UID of a prometheus data source.

5. execute query (replace `example` with the UID of a prometheus data source):
```bash
curl 'http://admin:admin@localhost:3000/apis/prometheus.grafana.app/v0alpha1/namespaces/default/connections/example/query' -X POST -d '@pkg/aggregator/examples/datasource-query.json'
```

### Research/PoC's

* [PoC Alternate HTTP backend](https://github.com/grafana/grafana/pull/100697)
* [PoC Plugin SDK <--> App SDK Adapter](https://github.com/grafana/grafana-app-sdk/pull/493)