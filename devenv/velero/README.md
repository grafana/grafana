# Velero Devenv

Velero is a backup solution in the Kubernetes ecosystem. Here, we provide a devenv for testing it against Grafana
API Server to test basic access patterns and RBAC assumptions that will make Velero compatible with Grafana API Server.

## Components

The devenv comprises various moving parts that are listed below:

### KinD

A KinD cluster is started, if not already existing on your machine. The port is auto-assigned.

### KinD registry

A registry is added on port 5000 in case you want to publish container images into it and run a built aggregated
server in KinD. For now, the local setup **doesn't require** you to do so.

### MinIO

A MinIO deployment is added to the KinD cluster. This acts as object storage for Velero.

### Veleo

A Velero deployment is added to the KinD cluster. This is what the `velero` CLI will interact with. You can use the CLI
to execute snapshots as follows:

```shell
# Specifying a namespace is necessary as Grafana assigns the ownership of Org 1 (default namespace) to Admin user
# and not much else
velero backup create snapshots-1 --include-resources=dashboards.dashboard.grafana.app --include-namespaces default

velero backup logs snapshots-1
```

### Grafana (running locally)

Grafana is assumed to be running locally at 6443 (with TLS enabled). TLS is a prerequisite for aggregation and it
can not be disabled. Your `custom.ini` should have following at minimum:

```ini
; enables the TLS port for grafana-apiserver during development
app_mode = development

[grafana-apiserver]
aggregation_enabled =  true

; following feature toggles will enable K8s Dashboards feature as well as allow you to interact with it using kubectl
[feature_toggles]
grafanaAPIServerWithExperimentalAPIs = true
grafanaAPIServerEnsureKubectlAccess = true
```

## Architecture

In order for Velero to work against Grafana Kinds, its essential that there is support for installing Velero and its
RBAC. That, in and of itself, substantiates the need for aggregation to a full/stock K8s server (KinD in this case).

Aggregation configs are provided as part of [kind devenv](../kind/aggregation-configs). If Grafana is running locally
with `make run`, you should see the APIService register successfully and enabled, on `tilt up`.

```shell
❯ kubectx
kind-kind
❯ k get apiservice v0alpha1.dashboard.grafana.app
NAME                             SERVICE           AVAILABLE   AGE
v0alpha1.dashboard.grafana.app   grafana/grafana   True        17h
```
