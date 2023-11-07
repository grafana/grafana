# grafana-example-apiserver

The example-apiserver allows the same CLI flags as kube-apiserver for customization. It closely resembles
the setup provided by the [sample-apiserver](https://github.com/kubernetes/sample-apiserver/tree/master).
It is currently used for testing our deployment pipelines for aggregated servers.

## Usage

At minimum, have `etcd` running in your environment and provide the following flags:

```shell
go run ./pkg/cmd/grafana-example-apiserver \
  --etcd-servers=http://127.0.0.1:2379 \
  --authentication-kubeconfig ~/.kube/config \
  --authorization-kubeconfig ~/.kube/config \
  --kubeconfig ~/.kube/config
```

Here, it's assumed that you have a local kind cluster and that you can provide its kubeconfig in the parameters to
the example-apiserver. Once, it is running, you can configure aggregation against your kind cluster
by specifying a `APIService` and it's corresponding `Service` object. Sample kustomizations are provided here
for local development on Linux and macOS.

```shell
kubectl deploy -k ./deploy/darwin # or /linux
```
