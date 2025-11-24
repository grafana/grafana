# Grafana CRD Support - POC Testing Guide

This directory contains example CRD definitions and custom resources for testing the Kubernetes CustomResourceDefinition (CRD) support in Grafana server.


## How to run

To run just compile Grafana with `make build-go` and then run the service with the `apiextensions.ini` provided under the `conf` folder.

```bash
./bin/darwin-arm64/grafana server --config conf/apiextensions.ini
```

To enable this feature we use the `apiExtensions = true` flag and also have unified storage as our storage backend.

There is no need for US service to run in ST Grafana, and the database will be a SQLite one.

## Testing Steps

### Step 1: Create a CustomResourceDefinition

Create the example CRD that defines a "Widget" resource:

```bash
kubectl apply -f ./pkg/registry/apis/apiextensions/resources/example-crd.yaml
```

Or use curl after you set a Grafana Service account token:
```bash
export AUTH_SVC="Authorization: Bearer glsa_<rest of the token>"
```

```bash
# From Grafana root
curl -k -X POST https://localhost:1111/apis/apiextensions.k8s.io/v1/customresourcedefinitions \
  -H "$AUTH_SVC" \
  -H "Content-Type: application/yaml" \
  --data-binary @$PWD/pkg/registry/apis/apiextensions/resources/example-crd.yaml
```

### Step 2: Verify the CRD was created

List all CRDs:

```bash
# Be sure to use the generated kube-config file
KUBECONFIG=$PWD/data/grafana-apiserver/apiserver.kubeconfig \
kubectl get customresourcedefinitions.apiextensions.k8s.io

# Or with curl:
curl -k -X GET https://localhost:1111/apis/apiextensions.k8s.io/v1/customresourcedefinitions \
  -H "$AUTH_SVC"
```

### Step 3: Create a Custom Resource Instance

Now that the CRD is registered, create an instance of the Widget resource:

```bash
kubectl apply -f ./pkg/registry/apis/apiextensions/resources/example-widget.yaml
```

Or use curl:

```bash
curl -k -X POST https://localhost:1111/apis/customcrdtest.grafana.app/v1/namespaces/default/widgets \
  -H "$AUTH_SVC" \
  -H "Content-Type: application/yaml" \
  --data-binary @$PWD/pkg/registry/apis/apiextensions/resources/example-widget.yaml
```

### Step 4: Verify the Custom Resource

> Note: You can see all the resources in SQLite database called `grafana.db`

List all widgets:

```bash
KUBECONFIG=$PWD/data/grafana-apiserver/apiserver.kubeconfig \
kubectl get widgets -n default

# Or with curl:
curl -k -X GET https://localhost:1111/apis/customcrdtest.grafana.app/v1/namespaces/default/widgets \
  -H "$AUTH_SVC" | jq .
```

### Step 5: Update the Custom Resource

Update the widget's spec:

```bash
KUBECONFIG=$PWD/data/grafana-apiserver/apiserver.kubeconfig \
kubectl edit widget my-widget -n default

# Or with curl (PATCH):
curl -X PATCH https://localhost:1111/apis/customcrdtest.grafana.app/v1/namespaces/default/widgets/my-widget \
  -H "Content-Type: application/merge-patch+json" \
  -H "$AUTH_SVC" \
  -d '{"spec":{"replicas":5}}'
```



## What is left

- [ ] Support multiple versions of CRDs (example in `discovery.go`)
- [ ] Watch new CRDs, so we do not require server restart `dynamic_registry.go`. This is needed for horizontal deployments.
- [ ] Support `/status` subresource
- [ ] Add tracer and logger and remove `fmt.Print`
- [ ] Implement MT setup
- [ ] Figure out how to modify storage checks for Cluster scoped resources (when we create a new CRD)
- [ ] How to tackle Cluster scoped CRs
- [ ] Use the feature flag to start the `apiextensions` service on-demand
