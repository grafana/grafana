# aggregator

This is a package that is intended to power the aggregation of microservices within Grafana. The concept
as well as implementation is largely borrowed from [kube-aggregator](https://github.com/kubernetes/kube-aggregator).

## Why aggregate services?

Grafana's future architecture will entail the same API Server design as that of Kubernetes API Servers. API Servers
provide a standard way of stitching together API Groups through discovery and shared routing patterns that allows
them to aggregate to a parent API Server in a seamless manner. Since we desire to break Grafana monolith up into
more functionally divided microservices, aggregation does the job of still being able to provide these services
under a single address. Other benefits of aggregation include free health checks and being able to independently 
roll out features for each service without downtime.

To read more about the concept, see 
[here](https://kubernetes.io/docs/tasks/extend-kubernetes/setup-extension-api-server/).

Note that, this aggregation will be a totally internal detail to Grafana. External fully functional APIServers that
may themselves act as parent API Servers to Grafana will never be made aware of them. Any of the `APIService` 
related to Grafana Groups registered in a real K8s environment will take the address of Grafana's 
parent server (which will bundle grafana-aggregator).

### kube-aggregator versus grafana-aggregator

The `grafana-aggregator` component will work similarly to how `kube-aggregator` works for `kube-apiserver`, the major
difference being that it doesn't require core V1 APIs such as `Service`. Early on, we decided to not have core V1
APIs in the root Grafana API Server. In order to still be able to implement aggregation, we do the following in this Go
package:

1. We do not start the core shared informer factories as well as any default controllers that utilize them. 
This is achieved using `DisabledPostStartHooks` facility under the GenericAPIServer's RecommendedConfig.
2. We provide an `externalname` Kind API implementation under `service.grafana.app` group which works functionally 
equivalent to the idea with the same name under `core/v1/Service`.
3. Lastly, we swap the default available condition controller with the custom one written by us. This one is based on
our `externalname` (`service.grafana.app`) implementation. We register separate `PostStartHooks` 
using `AddPostStartHookOrDie` on the GenericAPIServer to start the corresponding custom controller as well as 
requisite informer factories for our own `externalname` Kind.

### Gotchas (Pay Attention)

1. `grafana-aggregator` uses file storage under `/tmp`. System restarts won't preserve any configuration.
   1. Ensure any `externalname` and `APIService` configuration is in place post system restarts when developing locally.
2. Since `grafana-aggregator` outputs configuration (TLS and kubeconfig) that is used in the invocation of aggregated
  servers, ensure you start the aggregated service after launching the aggregator during local development.
