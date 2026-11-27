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
title: Manage resources in Grafana
menuTitle: Manage resources in Grafana
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/resources/manage-resources/
---

# Manage resources in Grafana

A resource created using as code tools has additional information fields in the form of annotations:

- `grafana.app/managedBy`: The manager of the resource, which depends on the tool that created it. Refer to Manager kinds for the available values.

- `grafana.app/managerId`: The instance of that tool. For Git Sync, this is the name of the repository resource. For Terraform, this is the provider identifier, for example `grafana-terraform-provider`.

A resource that carries both is a _managed resource_, and Grafana uses the record to decide whether you can change the resource in the UI and whether to reconcile it with an external source.

This page covers what each tool records and what it allows. For the annotations themselves, refer to [Manager and source annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#manager-and-source-annotations). To choose a tool, refer to [Overview of as code and provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/).

## Resource managers

The following table summarizes the available as code tools, who sets the annotations for resource management, the resource manager (`grafana.app/managedBy`) they use, the manager's instance (`grafana.app/managerId`), and whether Grafana records the file that the resource's definition comes from.

| Tool                                                                                                                   | Annotations set by | Manager                     | Instance                | Resource definition |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------- | ----------------------- | ------------------- |
| [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/)                                       | Grafana            | `repo`                      | The repository name     | Yes                 |
| [On-prem file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/)           | Grafana            | `repo`                      | The repository name     | Yes                 |
| [Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/terraform/)                                     | Caller             | `terraform`                 | The provider identifier | No                  |
| Kubernetes manifests                                                                                                   | Caller             | `kubectl`                   | The identifier you set  | No                  |
| Plugins                                                                                                                | Grafana            | `plugin`                    | The plugin identifier   | No                  |
| Grafana, for resources it owns itself, such as fixed roles                                                             | Grafana            | `grafana`                   | The resource name       | No                  |
| [`bootstrap_path`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#bootstrap_path) | Grafana            | `file-provisioning`         | `bootstrap`             | No                  |
| [Classic file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning)            | Grafana            | `classic-file-provisioning` | The provisioner name    | Yes                 |

{{< admonition type="note" >}}
`classic-file-provisioning`, `classic-api-provisioning`, and `classic-converted-prometheus` are deprecated and exist for migration only. The last two mark resources from the legacy Alerting provisioning HTTP API and the Alerting Convert Prometheus API, and record no manager identity because neither records the tool that made the call.
{{< /admonition >}}

### The `repo` manager

On-prem file provisioning uses the same `Repository` resource as Git Sync with the type set to `local`, which is why both record `repo`. Classic file provisioning is the older configuration-file mechanism and is unrelated to it, despite the similar name.

`bootstrap_path` marks only the `Repository` resource that the setting configures, so you can't edit that configuration in the UI. The dashboards and folders it provisions are managed by that repository and stay editable.

### Manage your resource definition

The **Resource definition** column shows whether Grafana records the file that a resource's definition comes from.
For more information on resource definitions, refer to [Resource definitions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/resources/#resource-definitions).

- **Yes:** The tool reconciles Grafana with a file, such as a dashboard JSON file in a repository or on disk, and that file is the source of truth. Grafana stores the path to the file in `grafana.app/sourcePath`, a checksum of its contents in `grafana.app/sourceChecksum`, and the time it last changed in `grafana.app/sourceTimestamp`, so that it can tell which file the resource comes from and whether the file has changed.
- **No:** Grafana doesn't record a source. Terraform and `kubectl` keep their definitions in files, but they send Grafana only the resulting API request. Plugins and Grafana itself create the resource directly, and `bootstrap_path` doesn't track the file it reads at startup.

## Set the resource manager

Grafana automatically sets the resource manager for most as code tools such as Git Sync.

### Set the manager yourself

If you're using Terraform and `kubectl` you need to set the resource manager yourself. Grafana reads the annotations and enforces them, but doesn't reconcile the resource against your manifest or state file.

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

### Release a resource from its manager

If you remove the manager annotations, the resource returns to normal UI management. Keep the following in mind:

- **Remove it from the tool, not from Grafana, whenever you can.** A tool that still lists the resource recreates or overwrites it on the next run.
- **Releasing a repository-managed resource requires an administrator role.** Nothing releases orphaned resources for you, so only administrators can detach one by hand.
- **You can't hand a resource from one tool to another in place.** Grafana rejects a write that changes either annotation on an existing resource. Remove the manager first, then let the new tool claim it.

For alerting, you can only release rules that came from Terraform, `kubectl`, or the legacy provisioning API. Rules from a repository or classic file provisioning are owned by an external source of truth, so an in-Grafana write can't reset them.

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

## Alerting provenance

Alerting resources also keep the older `grafana.com/provenance` annotation populated for tools that don't read manager properties yet. It's a coarser view, so several managers collapse onto one value:

| Manager                                         | `grafana.com/provenance` |
| ----------------------------------------------- | ------------------------ |
| Terraform, `kubectl`, legacy provisioning API   | `api`                    |
| Git Sync, on-prem and classic file provisioning | `file`                   |
| Convert Prometheus API                          | `converted_prometheus`   |
