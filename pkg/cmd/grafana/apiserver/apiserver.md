# grafana apiserver (standalone)

The example-apiserver closely resembles the 
[sample-apiserver](https://github.com/kubernetes/sample-apiserver/tree/master) project in code and thus
allows the same
[CLI flags](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/) as kube-apiserver.
It is currently used for testing our deployment pipelines for aggregated servers. You can optionally omit the
aggregation path altogether and just run this example apiserver as a standalone process.

## Standalone Mode

### Usage

```shell
go run ./pkg/cmd/grafana apiserver \
  --runtime-config=example.grafana.app/v0alpha1=true \
  --grafana-apiserver-dev-mode \
  --verbosity 10 \
  --secure-port 7443
```

### Verify that all works

In dev mode, the standalone server's loopback kubeconfig is written to `./data/grafana-apiserver/apiserver.kubeconfig`.

```shell
export KUBECONFIG=./data/grafana-apiserver/apiserver.kubeconfig

kubectl api-resources
NAME      SHORTNAMES   APIVERSION                     NAMESPACED   KIND
dummy                  example.grafana.app/v0alpha1   true         DummyResource
runtime                example.grafana.app/v0alpha1   false        RuntimeInfo
```

