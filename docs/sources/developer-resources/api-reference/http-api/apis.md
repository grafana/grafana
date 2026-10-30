---
aliases:
  - ../../../http_api/new_api_structure/ # /docs/grafana/next/http_api/new_api_structure/
  - ../../../developers/http_api/apis/ # /docs/grafana/next/developers/http_api/apis/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/apis/
description: ''
keywords:
  - grafana
  - http
  - documentation
  - api
labels:
  products:
    - enterprise
    - oss
    - cloud
title: API structure in Grafana
menuTitle: API Structure
weight: 01
---

# The new HTTP API structure in Grafana

{{< admonition type="note" >}}
Available in Grafana 12 and later.
{{< /admonition >}}

This document explains how Grafana structures the `/apis` HTTP APIs, which use a Kubernetes-style API layer with a standardized structure and consistent versioning. Read on to understand request paths, versions, namespaces, and common response fields when you migrate from legacy `/api` endpoints or work with new APIs.

For information about a specific API, refer to its doc. You can find them in [List of available HTTP APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api#list-of-available-http-apis).

## Before you begin

Before you begin, ensure you have the following:

- **Grafana version:** Use Grafana 12 or later.
- **API access:** Make sure you can send HTTP requests to your Grafana instance.
- **Legacy API context:** Know which legacy `/api` endpoints you want to replace if you're planning a migration.

## Migrate from legacy `api` endpoints

Grafana 13 deprecates legacy API endpoints (`/api`) in favor of a new generation of improved APIs (`/apis`). **Legacy APIs are not being disabled for the moment**. Removal of legacy APIs is planned for a future major release, and any breaking changes will be announced well in advance to avoid disruptions.

For more information, refer to [Migrate to the new APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration).

## API structure

Grafana APIs use a common path format and a common response shape.

### API path

All Grafana APIs follow this standardized format:

```text
/apis/<GROUP>/<VERSION>/namespaces/<NAMESPACE>/<RESOURCE>[/<NAME>]
```

Replace the placeholders with values for your API group, version, namespace, resource, and optional resource name. Use the final `/<NAME>` segment for operations on individual resources such as get, update, or delete. Omit it for collection operations such as list or create.

### API response format

All Grafana API responses follow this structure:

```json
{
  "kind": "<KIND>",
  "apiVersion": "<GROUP>/<VERSION>",
  "metadata": {
    "name": "<NAME>",
    "namespace": "<NAMESPACE>",
    "uid": "db323171-c78a-42fa-be98-16a3d799a779",
    "resourceVersion": "1758777451428472",
    "generation": 10,
    "creationTimestamp": "2026-01-23T22:06:40Z",
    "annotations": {}
  },
  "spec": {
    // resource-specific fields
  }
}
```

Replace the placeholders with the values returned by the resource you request.

## Understand the components

Each part of the path and response has a specific purpose.

### Group (`<group>`)

Groups organize related functionality into logical collections. For example, `dashboard.grafana.app` is used for dashboard-related operations.

### Version (`<version>`)

Grafana APIs use semantic versioning with three stability levels:

| Level | Format     | Description                                                                 | Use Case                 | Enabled By Default? |
| ----- | ---------- | --------------------------------------------------------------------------- | ------------------------ | ------------------- |
| Alpha | `v1alpha1` | Early development stage. Unstable, may contain bugs, and subject to removal | For testing new features | No                  |
| Beta  | `v1beta1`  | More stable than alpha, but may still have some changes                     | For non-critical use     | No                  |
| GA    | `v1`       | Generally Available. Stable with backward compatibility guarantees          | For production use       | Yes                 |

#### Alpha

Alpha versions should not be served unless explicitly enabled by a feature flag, and should be considered completely experimental and subject to major changes.
An alpha version may undergo breaking changes without adding an additional version, and should not be relied upon by production workflows. Alpha versions may be removed completely, even without being promoted to a more stable level (e.g. an experimental API may be introduced as alpha for a new feature and subsequently removed completely, in case that feature gets canceled).

#### Beta

Beta versions should not contain breaking changes in the schema, but still may be subject to changes in handling logic or semantics.
Breaking schema changes require a new published beta version (such as publishing `v1beta2` for breaking changes to the `v1beta1` schema).
While beta versions are no longer considered experimental like alpha versions, they should still be disabled by default.

#### GA

GA versions are enabled by default, and can be treated as completely stable. The only changes that can be made to these APIs are bug fixes, and any other changes should instead result in a new published version of the API.

### Namespace (`<namespace>`)

Namespaces isolate resources within your Grafana instance. The format varies by deployment type:

#### OSS and on-premise Grafana

- **Default organization:** Use `default` for organization 1.
- **Additional organizations:** Use `org-<ORG_ID>`.

#### Grafana Cloud

- **Format:** Use `stacks-<STACK_ID>`.
- **Instance ID:** Your instance ID is the `STACK_ID`.

You can find the instance ID in the following places:

- **Grafana Cloud portal:** Go to `grafana.com`, open your stack, and select **Details** for your Grafana instance.
- **Swagger UI:** Open the `/swagger` page in your Grafana Cloud instance, where the namespace is automatically populated for the relevant endpoints.

### Resource (`<resource>`)

The resource is the type you want to interact with. Common examples include the following:

- **Dashboards:** Use `dashboards`.
- **Playlists:** Use `playlists`.
- **Folders:** Use `folders`.

### Kind (`<kind>`)

The kind identifies the resource type in API responses and corresponds to the singular form of the resource.
For example, the `dashboards` resource has a kind of `Dashboard`.

### Name (`<name>`)

The `<name>` is the unique identifier for a specific instance of a resource within its namespace and resource type. `<name>` is distinct from the `metadata.uid` field. The URL path always uses `metadata.name`.

For example, to get a dashboard defined as:

```json
{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1",
  "metadata": {
    "name": "production-overview", // This value IS used in the URL path
    "namespace": "default",
    "uid": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8" // This value is NOT used in the URL path
    // ... other metadata
  },
  "spec": {
    // ... dashboard spec
  }
}
```

You would use the following API call:

`GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/production-overview`

### Metadata

The metadata section contains information about the resource instance.
This section includes [name](#name-name) and [namespace](#namespace-namespace), which are described earlier in this document, along with the following fields:

#### UID

An internal identifier that can be ignored for most use cases. Use the `name` field as the unique identifier instead. This value is _not_ the same as the Grafana UID.

#### ResourceVersion

A value that changes whenever any part of the resource changes, including metadata or status.

Use this field for:

- **Change detection:** Track whether the resource has changed.
- **Optimistic concurrency control:** Prevent overwriting a newer version of the resource.

#### Generation

A monotonically increasing number that increments only when the spec changes.
Updates to metadata or status don't affect this value.

#### CreationTimestamp

The time the object was created, formatted as an RFC 3339 UTC timestamp (for example, `2026-01-23T22:06:40Z`).

#### Annotations

A map of key-value pairs.

Common annotations include:

- **`grafana.app/createdBy` and `grafana.app/updatedBy`:** Identify who created or last updated the resource. Use the format `<USER_TYPE>:<UID>`, for example `user:u000000839`.
- **`grafana.app/folder`:** If the resource supports folders, this contains the folder UID that the object belongs to.
- **`grafana.app/updatedTimestamp`:** Stores the last update time as an RFC 3339 UTC timestamp, for example `2026-01-23T05:17:31Z`.
- **`grafana.app/managedBy` and `grafana.app/managerId`:** Identify the tool that manages the resource, such as Git Sync or Terraform. Refer to [Manager and source annotations](#manager-and-source-annotations).

#### Manager and source annotations

Resources that an external tool manages, such as Git Sync, Terraform, or `kubectl`, carry additional annotations.
Grafana uses them to record which tool owns a resource, where the resource definition comes from, and whether you can edit the resource outside of that tool.

The managing tool sets these annotations for you. Don't set them by hand on resources you create through the API.

Use the following annotations to identify the manager:

| Annotation                       | Description                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grafana.app/managedBy`          | The kind of tool that manages the resource. Refer to [Manager kinds](#manager-kinds) for the available values.                                                                       |
| `grafana.app/managerId`          | The instance of that tool. For Git Sync, this is the name of the repository resource. For Terraform, this is the provider identifier, for example `grafana-terraform-provider`.      |
| `grafana.app/managerAllowsEdits` | When `true`, requesters other than the manager can edit the resource. When the annotation is absent or set to `false`, Grafana treats the resource as read-only outside its manager. |
| `grafana.app/managerSuspended`   | When `true`, the manager skips updates to the resource. Use it to pause reconciliation without removing the manager.                                                                 |

Grafana treats a resource as managed only when `grafana.app/managerId` holds a non-empty value.
A `grafana.app/managedBy` annotation on its own doesn't mark a resource as managed.

Grafana writes `grafana.app/managerAllowsEdits` only when the value is `true`, so an absent annotation and `false` mean the same thing.
In API responses that expose manager properties, such as search results, the same value appears as the `allowEdits` field.
Each tool sets it differently: Grafana derives it from the `allowUiUpdates` option for classic file provisioning, Terraform and `kubectl` callers set it themselves, and repository-backed resources don't use it, because Grafana sends an edit of one to its repository instead of rejecting it.
Refer to [Managed resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/managed-resources/) for what each tool records and allows.

Use the following annotations to identify the source of a provisioned resource.
Managers that reconcile from a source, such as Git Sync, set them. Managers without a concept of a source, such as Terraform, don't.

| Annotation                    | Description                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `grafana.app/sourcePath`      | The path to the resource definition in the source, for example `dashboards/my-dashboard.json`.    |
| `grafana.app/sourceChecksum`  | The checksum of the resource definition in the source, such as a Git commit hash.                 |
| `grafana.app/sourceTimestamp` | The time the resource definition last changed in the source, as a Unix timestamp in milliseconds. |

##### Manager kinds

The `grafana.app/managedBy` annotation accepts the following values:

| Value       | Description                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `repo`      | A repository manages the resource, either Git Sync or on-prem file provisioning, and `grafana.app/managerId` holds the repository name. |
| `terraform` | A Terraform provider manages the resource.                                                                                              |
| `kubectl`   | A Kubernetes manifest applied with `kubectl` manages the resource.                                                                      |
| `plugin`    | A plugin manages the resource.                                                                                                          |
| `grafana`   | Grafana manages the resource itself.                                                                                                    |

Grafana also sets `classic-file-provisioning`, `classic-api-provisioning`, and `classic-converted-prometheus` on resources that come from legacy provisioning: classic file provisioning, the legacy Alerting provisioning HTTP API, and the Alerting Convert Prometheus API.
These values are deprecated and exist for migration only. New resources use one of the values in the preceding table.

##### Change the manager of a resource

You can't change the manager of a resource in place.
Grafana rejects a write that changes `grafana.app/managedBy` with a `403 Forbidden` response that carries a `ResourceManagerKindConflict` cause, and rejects a write that changes `grafana.app/managerId` with a `403 Forbidden` response.
A Terraform provider is the one exception: it can migrate a resource from a deprecated User-Agent identity to a stable one.

To hand a resource over to a different tool, remove the manager annotations first, then write them again with the new values.
Removing the manager from a resource that Git Sync manages requires an administrator role.

##### Deprecated repository annotations

Earlier versions of Grafana recorded Git Sync ownership with the following annotations.
Grafana still reads them, but it writes the manager and source annotations instead:

| Deprecated annotation       | Replacement                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `grafana.app/repoName`      | `grafana.app/managerId`, with `grafana.app/managedBy` set to `repo` |
| `grafana.app/repoPath`      | `grafana.app/sourcePath`                                            |
| `grafana.app/repoHash`      | `grafana.app/sourceChecksum`                                        |
| `grafana.app/repoTimestamp` | `grafana.app/sourceTimestamp`                                       |

#### Labels

An optional map of key-value pairs for organizing and selecting resources.

### Spec

The spec field describes the desired state of the resource. Its structure depends on the resource type and API version. Refer to the Swagger or OpenAPI documentation for the exact schema for a resource's spec.

## Related resources

Use the following resources to keep working with Grafana APIs:

- **Migration guide:** Refer to [Migrate to the new APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration).
- **HTTP API reference:** Refer to [HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/).
- **Swagger UI:** Open the `/swagger` page in your Grafana instance to inspect endpoint schemas and try requests.
