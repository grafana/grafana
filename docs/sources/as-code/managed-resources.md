---
description: Understand how Grafana records which tool manages a resource, and what that means for editing it.
keywords:
  - as code
  - as-code
  - provisioning
  - git sync
  - terraform
  - kubectl
  - managed resources
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Managed resources
menuTitle: Managed resources
weight: 50
canonical: https://grafana.com/docs/grafana/latest/as-code/managed-resources/
---

# Managed resources

When an as-code tool creates a resource, Grafana records which tool manages it in the `grafana.app/managedBy` and `grafana.app/managerId` annotations.
A resource that carries both is a _managed resource_, and Grafana uses the record to decide whether you can change the resource in the UI and whether to reconcile it with an external source.

This page covers what each tool records and what it allows. For the annotations themselves, refer to [Manager and source annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#manager-and-source-annotations). To choose a tool, refer to [Overview of as code and provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/).

## Managers

| Tool                                                                                                                   | `grafana.app/managedBy`     | `grafana.app/managerId` | Set by  | Records a source |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- | ------- | ---------------- |
| [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/)                                       | `repo`                      | The repository name     | Grafana | Yes              |
| [On-prem file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/)           | `repo`                      | The repository name     | Grafana | Yes              |
| [Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/terraform/)                                     | `terraform`                 | The provider identifier | Caller  | No               |
| Kubernetes manifests                                                                                                   | `kubectl`                   | The identifier you set  | Caller  | No               |
| Plugins                                                                                                                | `plugin`                    | The plugin identifier   | Grafana | No               |
| Grafana, for resources it owns itself, such as fixed roles                                                             | `grafana`                   | The resource name       | Grafana | No               |
| [`bootstrap_path`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#bootstrap_path) | `file-provisioning`         | `bootstrap`             | Grafana | No               |
| [Classic file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning)            | `classic-file-provisioning` | The provisioner name    | Grafana | Yes              |

On-prem file provisioning uses the same `Repository` resource as Git Sync with the type set to `local`, which is why both record `repo`. Classic file provisioning is the older configuration-file mechanism and is unrelated to it, despite the similar name.

`bootstrap_path` marks only the `Repository` resource that the setting configures, so you can't edit that configuration in the UI. The dashboards and folders it provisions are managed by that repository and stay editable.

{{< admonition type="note" >}}
`classic-file-provisioning`, `classic-api-provisioning`, and `classic-converted-prometheus` are deprecated and exist for migration only. The last two mark resources from the legacy Alerting provisioning HTTP API and the Alerting Convert Prometheus API, and record no manager identity because neither records the tool that made the call.
{{< /admonition >}}

### Set the manager yourself

Terraform and `kubectl` are the only managers you set yourself. Grafana reads the annotations and enforces them, but doesn't reconcile the resource against your manifest or state file.

```yaml
apiVersion: dashboard.grafana.app/v1
kind: Dashboard
metadata:
  name: my-dashboard
  annotations:
    grafana.app/managedBy: kubectl
    grafana.app/managerId: my-cluster
spec:
  title: My dashboard
```

Replace _`my-cluster`_ with an identifier for the tool or cluster that owns the resource, and keep it stable, because you can't change it later.
The Grafana CLI, `gcx`, also pushes as `kubectl`, because it has no manager kind of its own yet.

Grafana derives every other value, and rejects a write that sets `classic-file-provisioning` from anything but the file provisioner.

## Edit a managed resource

Grafana reads the `grafana.app/managerAllowsEdits` annotation to decide whether a requester other than the manager can change a resource.
Grafana only writes the annotation when it's `true`, so an absent annotation and `false` both mean no.

| Manager                   | Edits in the UI                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git Sync                  | Allowed. Grafana sends the change to the repository as a commit.                                                                                                                                                                                |
| On-prem file provisioning | Allowed. Grafana writes the change back to the file.                                                                                                                                                                                            |
| Terraform, `kubectl`      | Allowed when the caller sets `grafana.app/managerAllowsEdits` to `true`.                                                                                                                                                                        |
| Classic file provisioning | Allowed when the provisioning configuration sets [`allowUiUpdates`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#make-changes-to-a-provisioned-dashboard) to `true`, which Grafana stores as the annotation. |
| Plugins, Grafana          | Not allowed.                                                                                                                                                                                                                                    |

An edit that the manager doesn't allow fails with a _Cannot save provisioned dashboard_ message.

{{< admonition type="caution" >}}
Allowing edits doesn't make a change permanent. Where a manager reconciles from a source, that source stays authoritative and the next reconciliation overwrites what you saved in the UI.
{{< /admonition >}}

## Release a resource from its manager

Removing the manager annotations returns a resource to normal UI management. Keep the following in mind:

- **Remove it from the tool, not from Grafana, whenever you can.** A tool that still lists the resource recreates or overwrites it on the next run.
- **Releasing a repository-managed resource requires an administrator role.** Nothing releases orphaned resources for you, so only administrators can detach one by hand.
- **You can't hand a resource from one tool to another in place.** Grafana rejects a write that changes either annotation on an existing resource. Remove the manager first, then let the new tool claim it.

For alerting, you can only release rules that came from Terraform, `kubectl`, or the legacy provisioning API. Rules from a repository or classic file provisioning are owned by an external source of truth, so an in-Grafana write can't reset them.

## Alerting provenance

Alerting resources also keep the older `grafana.com/provenance` annotation populated for tools that don't read manager properties yet. It's a coarser view, so several managers collapse onto one value:

| Manager                                         | `grafana.com/provenance` |
| ----------------------------------------------- | ------------------------ |
| Terraform, `kubectl`, legacy provisioning API   | `api`                    |
| Git Sync, on-prem and classic file provisioning | `file`                   |
| Convert Prometheus API                          | `converted_prometheus`   |
