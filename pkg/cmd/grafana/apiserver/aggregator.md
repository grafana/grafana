# grafana aggregator

The `aggregator` command in this binary is our equivalent of what kube-apiserver does for aggregation using
the `kube-aggregator` pkg. Here, we enable only select controllers that are useful for aggregation in a Grafana
cloud context. In future, Grafana microservices (and even plugins) will run as separate API servers
hosting each their own APIs (with specific Group/Versions). The `aggregator` component here shall act similar to what
`kube-apiserver` does: doing healthchecks for `APIService` objects registered against it and acting as a proxy for
the specified `GroupVersion` therein.

## How to get started

1. Generate the PKI using `openssl` (for development purposes, we will use the CN of `system:masters`):
  ```shell
  openssl req -nodes -new -x509 -keyout ca.key -out ca.crt
  openssl req -out client.csr -new -newkey rsa:4096 -nodes -keyout client.key -subj "/CN=development/O=system:masters"
  openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -sha256 -out client.crt
  ```
2. Start the aggregator:
  ```shell
  # This will generate the kubeconfig which you can use in the extension apiservers for
  # enforcing delegate authnz under $PWD/data/grafana-apiserver/aggregator.kubeconfig 
  go run ./pkg/cmd/grafana aggregator --secure-port 8443
  ```
3. Apply the manifests: 
  ```shell
  export KUBECONFIG=$PWD/data/grafana-apiserver/aggregator.kubeconfig
  kubectl apply -k ./pkg/cmd/grafana/apiserver/deploy/aggregator-test
  # SAMPLE OUTPUT
  # apiservice.apiregistration.k8s.io/v0alpha1.example.grafana.app created
  # externalname.service.grafana.app/example-apiserver created
  
  kubectl get apiservice
  # SAMPLE OUTPUT
  # NAME                           SERVICE                     AVAILABLE                      AGE
  # v0alpha1.example.grafana.app   grafana/example-apiserver   False (FailedDiscoveryCheck)   29m
  ```
4. In another tab, start the example microservice that will be aggregated by the parent apiserver:
  ```shell
  go run ./pkg/cmd/grafana apiserver example.grafana.app \
    --kubeconfig $PWD/data/grafana-apiserver/aggregator.kubeconfig \
    --secure-port 7443 \
   --client-ca-file=$PWD/ca.crt
  ```
5. Check `APIService` again:
  ```shell
  export KUBECONFIG=$PWD/data/grafana-apiserver/aggregator.kubeconfig
  kubectl get apiservice
  # SAMPLE OUTPUT
  # NAME                           SERVICE                     AVAILABLE      AGE
  # v0alpha1.example.grafana.app   grafana/example-apiserver   True           30m
  ```
