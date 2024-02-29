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

Note that this aggregation will be a totally internal detail to Grafana. External fully functional API Servers that
may themselves act as parent API Servers to Grafana will never be made aware of internal Grafana API Servers.
Thus, any `APIService` objects corresponding to Grafana's API groups will take the address of 
Grafana's main API Server (the one that bundles grafana-aggregator).

Also, note that the single binary OSS offering of Grafana doesn't make use of the aggregator component at all, instead
opting for local installation of all the Grafana API groups.

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
4. For now, we bundle apiextensions-apiserver under our aggregator component. This is slightly different from K8s
where kube-apiserver is called the top-level component and controlplane, aggregator and apiextensions-apiserver
live under that instead.

### Gotchas (Pay Attention)

1. `grafana-aggregator` uses file storage under `data/grafana-apiserver` (`apiregistration.k8s.io`,
`service.grafana.app`). Thus, any restarts will still have any prior configured aggregation in effect.
2. During local development, ensure you start the aggregated service after launching the aggregator. This is
so you have TLS and kubeconfig available for use with example aggregated api servers.
3. Ensure you have `grafanaAPIServerWithExperimentalAPIs = false` in your custom.ini. Otherwise, the example
service the following guide uses for the aggregation test is bundled as a `Local` `APIService` and will cause
configuration overwrites on startup.

## Testing aggregation locally

1. Generate the PKI using `openssl` (for development purposes, we will use the CN of `system:masters`):
  ```shell
  ./hack/make-aggregator-pki.sh
  ```
2. Configure the aggregator:
  ```ini
  [feature_toggles]
  grafanaAPIServerEnsureKubectlAccess = true
  ; disable the experimental APIs flag to disable bundling of the example service locally
  grafanaAPIServerWithExperimentalAPIs = false
  kubernetesAggregator = true

  [grafana-apiserver]
  proxy_client_cert_file = ./data/grafana-aggregator/client.crt
  proxy_client_key_file = ./data/grafana-aggregator/client.key
  ```
3. Start the server
  ```shell
  make run
  ```
4. In another tab, apply the manifests: 
  ```shell
  export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
  kubectl apply -f ./pkg/services/apiserver/aggregator/examples/manual-test/
  # SAMPLE OUTPUT
  # apiservice.apiregistration.k8s.io/v0alpha1.example.grafana.app created
  # externalname.service.grafana.app/example-apiserver created
  
  kubectl get apiservice
  # SAMPLE OUTPUT
  # NAME                           SERVICE                     AVAILABLE                      AGE
  # v0alpha1.example.grafana.app   grafana/example-apiserver   False (FailedDiscoveryCheck)   29m
  ```
5. In another tab, start the example microservice that will be aggregated by the parent apiserver:
  ```shell
  go run ./pkg/cmd/grafana apiserver \
    --runtime-config=example.grafana.app/v0alpha1=true \
    --secure-port 7443 \
    --tls-cert-file $PWD/data/grafana-aggregator/server.crt \
    --tls-private-key-file $PWD/data/grafana-aggregator/server.key \ 
    --requestheader-client-ca-file=$PWD/data/grafana-aggregator/ca.crt \
    --requestheader-extra-headers-prefix=X-Remote-Extra- \
    --requestheader-group-headers=X-Remote-Group \
    --requestheader-username-headers=X-Remote-User \
    -v 10
  ```
6. After 10 seconds, check `APIService` again. It should report as available.
  ```shell
  export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
  kubectl get apiservice
  # SAMPLE OUTPUT
  # NAME                           SERVICE                     AVAILABLE      AGE
  # v0alpha1.example.grafana.app   grafana/example-apiserver   True           30m
  ```
7. For tear down of the above test:
  ```shell
  kubectl delete -f ./pkg/services/apiserver/aggregator/examples/
  ```

## Testing auto-registration of remote services locally

A sample aggregation config for remote services is provided under [conf](../../../../conf/aggregation/apiservices.yaml). Provided, you have the following setup in your custom.ini, the apiserver will
register your remotely running services on startup.

```ini
; in custom.ini
; the bundle is only used when not in dev mode
apiservice_ca_bundle_file = ./data/grafana-aggregator/ca.crt

remote_services_file = ./pkg/services/apiserver/aggregator/examples/autoregister/apiservices.yaml
```
