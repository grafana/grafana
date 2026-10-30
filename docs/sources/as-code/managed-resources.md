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

When you create a resource with an as-code tool, such as Git Sync, Terraform, or `kubectl`, Grafana records which tool manages it.
Grafana calls this resource a _managed resource_, and it uses that record to decide whether you can change the resource in the UI, and whether it needs to reconcile the resource with an external source.

Read this page to learn which tools Grafana recognizes as managers, what each one records, and how to edit or release a resource that a tool manages.

## How Grafana records the manager

Grafana stores the manager in annotations on the resource:

- **`grafana.app/managedBy`:** The kind of tool that manages the resource.
- **`grafana.app/managerId`:** The instance of that tool, such as a repository name.

A resource counts as managed only when it has both. Resources that come from a source that Grafana reconciles, such as a file in a Git repository, also record the path, checksum, and modification time of that source.

For the full list of annotations, including the source annotations and the rules for changing them, refer to [Manager and source annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#manager-and-source-annotations).

## Managers

The following tools manage resources in Grafana.

| Tool                 | `grafana.app/managedBy`     | `grafana.app/managerId`                     | Records a source |
| -------------------- | --------------------------- | ------------------------------------------- | ---------------- |
| Git Sync             | `repo`                      | The name of the repository resource         | Yes              |
| Terraform            | `terraform`                 | The provider identifier                     | No               |
| Kubernetes manifests | `kubectl`                   | The identifier you set                      | No               |
| Plugins              | `plugin`                    | The plugin identifier                       | No               |
| Grafana              | `grafana`                   | The name of the resource                    | No               |
| File provisioning    | `classic-file-provisioning` | The provisioner name from the configuration | Yes              |

### Git Sync

Grafana sets the annotations on every resource that Git Sync creates, and records the file each resource comes from.

You can edit a Git Sync resource in the UI. Grafana doesn't save the change to its database directly: it sends the change to the repository as a commit, so the repository stays the source of truth.
Refer to [Work with provisioned resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/provisioned-dashboards/).

### Terraform

The Grafana Terraform provider sets the annotations on the resources it creates, using its own identifier as the manager identity, for example `grafana-terraform-provider`.
Terraform holds the desired state in its own configuration and state files rather than in a source that Grafana reads, so Terraform resources don't record a source.

Older versions of the provider used the HTTP `User-Agent` header as the manager identity, which changed with every provider release.
Grafana lets a Terraform provider replace a `User-Agent` identity with a stable one, but it doesn't let a provider change back.

### Kubernetes manifests

When you apply a manifest with `kubectl`, you set the manager annotations in the manifest yourself.
Grafana reads them, but it doesn't set them for you, and it doesn't reconcile the resource against the manifest.

The following manifest marks a dashboard as managed by `kubectl`:

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

Replace _`my-cluster`_ with an identifier for the tool or cluster that owns the resource. Keep it stable, because you can't change it later.

### Plugins

Grafana marks dashboards that ship with a plugin as managed by that plugin, using the plugin identifier as the manager identity.
Update these dashboards by updating the plugin.

### Grafana

Grafana marks the resources it owns itself, such as fixed roles, as managed by `grafana`.
You can't change or release these resources.

### File provisioning

Grafana marks resources that come from file provisioning with the deprecated `classic-file-provisioning` value, using the provisioner name from the provisioning configuration as the manager identity.
It records the file path, checksum, and modification time as the source.

Refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning).

{{< admonition type="note" >}}
Grafana also uses `classic-api-provisioning` for resources created through the legacy Alerting provisioning HTTP API, and `classic-converted-prometheus` for rules imported by the Alerting Convert Prometheus API. Neither records a manager identity, because neither records the tool that made the call.

These three values are deprecated and exist for migration only. New resources use one of the other values.
{{< /admonition >}}

## Edit a managed resource

Whether you can change a managed resource in the UI depends on its manager.

Grafana reads the `grafana.app/managerAllowsEdits` annotation to decide.
When the annotation is set to `true`, requesters other than the manager can change the resource. When it's absent, they can't, and Grafana rejects the write.
Grafana only writes the annotation when it's `true`, so an absent annotation and `false` mean the same thing.

The following table shows how each manager treats edits:

| Manager              | Edits in the UI                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Git Sync             | Allowed. Grafana sends the change to the repository as a commit instead of saving it directly. |
| Terraform            | Allowed when the provider sets `grafana.app/managerAllowsEdits` to `true`.                     |
| Kubernetes manifests | Allowed when the manifest sets `grafana.app/managerAllowsEdits` to `true`.                     |
| File provisioning    | Allowed when the provisioning configuration sets `allowUiUpdates` to `true`.                   |
| Plugins              | Not allowed.                                                                                   |
| Grafana              | Not allowed.                                                                                   |

For file provisioning, Grafana derives the annotation from the `allowUiUpdates` option, so you don't set the annotation yourself.
Grafana saves the change to its database, and overwrites it the next time the provisioning source changes.
Refer to [Make changes to a provisioned dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#make-changes-to-a-provisioned-dashboard).

An edit that a manager doesn't allow fails with a _Cannot save provisioned dashboard_ message in the UI.

{{< admonition type="caution" >}}
Allowing edits doesn't make the change permanent. For every manager that reconciles from a source, the source stays authoritative, and the next reconciliation overwrites whatever you saved in the UI.
{{< /admonition >}}

## Release a resource from its manager

To stop a tool from managing a resource, remove the manager annotations. Grafana then treats the resource as a regular resource that you manage in the UI.

Keep the following in mind:

- **Remove the manager from the tool, not from Grafana, whenever you can.** A tool that still has the resource in its configuration recreates or overwrites it on the next run. For Terraform, remove the resource from your configuration. For Git Sync, remove the file from the repository.
- **Releasing a Git Sync resource requires an administrator role.** Grafana has no process that releases orphaned resources for you, so only administrators can detach one by hand.
- **You can't hand a resource from one tool to another in place.** Grafana rejects a write that changes `grafana.app/managedBy` or `grafana.app/managerId` on an existing resource. Remove the manager first, then let the new tool claim the resource.

Alerting resources are more restrictive: you can only release rules that came from Terraform, `kubectl`, or the legacy provisioning API.
Rules that come from file provisioning or Git Sync are owned by an external source of truth, so Grafana doesn't let an in-Grafana write reset them to unmanaged.

## Alerting provenance

Alerting resources record a manager the same way, and also keep the older `grafana.com/provenance` annotation populated for tools that don't read manager properties yet.
Provenance is a coarser view of the same information, so several managers collapse onto one provenance value:

| Manager                                       | `grafana.com/provenance` |
| --------------------------------------------- | ------------------------ |
| Terraform, `kubectl`, legacy provisioning API | `api`                    |
| Git Sync, file provisioning                   | `file`                   |
| Convert Prometheus API                        | `converted_prometheus`   |

## Related resources

Use the following resources to keep working with managed resources:

- **Annotation reference:** Refer to [Manager and source annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#manager-and-source-annotations).
- **Git Sync:** Refer to [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/).
- **File provisioning:** Refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning).
- **Terraform:** Refer to [Use Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/terraform/).
