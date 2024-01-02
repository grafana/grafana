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
go run ./pkg/cmd/grafana apiserver example.grafana.app \
  --secure-port 7443
```

### Verify that all works

```shell
export KUBECONFIG=./example-apiserver/kubeconfig

kubectl api-resources
NAME      SHORTNAMES   APIVERSION                     NAMESPACED   KIND
dummy                  example.grafana.app/v0alpha1   true         DummyResource
runtime                example.grafana.app/v0alpha1   false        RuntimeInfo
```

## Aggregated Mode

### Prerequisites:
1. kind: you will need kind (or another local K8s setup) if you want to test aggregation.
  ```
  go install sigs.k8s.io/kind@v0.20.0 && kind create cluster
  ```

### Usage

You can start the example-apiserver with an invocation as shown below. The delegate Authn / Authz flags are skipped for
ease of development. Here, it's assumed that you have a local  kind cluster and that you can provide its kubeconfig in
the parameters to the example-apiserver so kind can play the part as a root apiserver.

```shell
go run ./pkg/cmd/grafana apiserver example.grafana.app \
  --kubeconfig ~/.kube/config \
  --secure-port 7443
```

Once, the `example-apiserver` is running, you can configure aggregation against your kind cluster
by applying a `APIService` and it's corresponding `Service` object. Sample kustomizations are provided
for local development on [Linux](./deploy/linux/kustomization.yaml) and [macOS](./deploy/darwin/kustomization.yaml).

```shell
kubectl apply -k ./deploy/darwin # or /linux
```


### Verify that all works

With kubectl configured against `kind-kind` context, you can run the following:

```shell
kubectl get --raw /apis/example.grafana.app/v0alpha1 | jq -r
{
  "kind": "APIResourceList",
  "apiVersion": "v1",
  "groupVersion": "example.grafana.app/v0alpha1",
  "resources": [
    {
      "name": "runtime",
      "singularName": "runtime",
      "namespaced": false,
      "kind": "RuntimeInfo",
      "verbs": [
        "list"
      ]
    }
  ]
}
```

```shell
kubectl get apiservice v0alpha1.example.grafana.app
NAME                           SERVICE                     AVAILABLE   AGE
v0alpha1.example.grafana.app   grafana/example-apiserver   True        4h1m
```
