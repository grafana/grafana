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
title: New API Structure
---

# Grafana's New API Structure

## Overview

Going forward, Grafana's HTTP API will follow a standardized API structure alongside consistent API versioning.

### API Path Structure

All Grafana APIs follow this standardized format:

```
/apis/<group>/<version>/namespaces/<namespace>/<resource>[/<name>]
```

Where the final `/<name>` segment is used for operations on individual resources (like Get, Update, Delete) and omitted for collection operations (like List, Create).

### API Response Format

All Grafana API responses will follow this structure:

```
{
  "kind": "<kind>",
  "apiVersion": "<group>/<version>",
  "metadata": {
    "name": "<name>",
    "namespace": "<namespace>",
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

## Understanding the Components

### Group (`<group>`)

Groups organize related functionality into logical collections. For example `dashboard.grafana.app` will be used for all dashboard-related operations.

### Version (`<version>`)

These APIs will also uses semantic versioning with three stability levels:

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

GA versions are enabled by default, and can be treated as completely stable. The only changes that can be made to these APIs are bug fixes,
and any other changes should instead result in a new published version of the API.

### Namespace (`<namespace>`)

Namespaces isolate resources within your Grafana instance. The format varies by deployment type:

#### OSS & On-Premise Grafana

- Default organization (org 1): `default`
- Additional organizations: `org-<org_id>`

#### Grafana Cloud

- Format: `stacks-<stack_id>`
- Your instance ID is the `stack_id`. You can find this value by either:
  - Going to grafana.com, clicking on your stack, and selecting "Details" on your Grafana instance
  - Accessing the /swagger page in your cloud instance, where the namespace will be automatically populated on the relevant endpoints

### Resource (`<resource>`)

The resource type you want to interact with, such as:

- `dashboards`
- `playlists`
- `folders`

### Kind (`<kind>`)

The kind identifies the resource type in API responses and corresponds to the singular form of the resource.
For example, the `dashboards` resource has a kind of `Dashboard`.

### Name (`<name>`)

The `<name>` is the unique identifier for a specific instance of a resource within its namespace and resource type. `<name>` is distinct from the metadata.uid field. The URL path will always use the metadata.name.

For example, to get a dashboard defined as:

```
{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1beta1",
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

`GET /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/production-overview`

### Metadata

The metadata section contains information about the resource instance.
This section includes [name](#name-name) and [namespace](#namespace-namespace), which are described earlier in this document, along with the following fields:

#### UID

An internal identifier that can be ignored for most use cases. Use the `name` field as the unique identifier instead. This value is _not_ the same as the Grafana UID.

#### ResourceVersion

A value that changes whenever any part of the resource changes, including metadata or status.

Use this field for:

- Change detection
- Optimistic concurrency control

#### Generation

A monotonically increasing number that increments only when the spec changes.
Updates to metadata or status don't affect this value.

#### CreationTimestamp

The time the object was created, formatted as an RFC 3339 UTC timestamp (for example, `2026-01-23T22:06:40Z`).

#### Annotations

A map of key-value pairs.

Common annotations include:

- `grafana.app/createdBy` / `grafana.app/updatedBy`: Identifies who created or last updated the resource.
  Format: `<user-type>:<uid>` (for example, user:u000000839)
- `grafana.app/folder`: If the resource supports folders, contains the folder UID the object belongs to.
- `grafana.app/updatedTimestamp`: Timestamp of the last update, formatted as RFC 3339 UTC
  (for example, `2026-01-23T05:17:31Z`).

#### Labels

An optional map of key-value pairs for organizing and selecting resources.

### Spec

The spec field describes the desired state of the resource. Its structure is specific to the resource type and API version. Refer to the Swagger / OpenAPI documentation for the exact schema of each resource’s spec.
