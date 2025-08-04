---
aliases:
  - ../../http_api/new_api_structure/
  - ../../http_api/new_api_structure/
canonical: /docs/grafana/latest/developers/http_api/new_api_structure/
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
title: New API Structure
---

# Grafana's New API Structure

## Overview

Going forward, Grafana's HTTP API will follow a standardized API structure alongside consistent API versioning.

## API Path Structure

All Grafana APIs follow this standardized format:

```
/apis/<group>/<version>/namespaces/<namespace>/<resource>[/<name>]
```

Where the final `/<name>` segment is used for operations on individual resources (like Get, Update, Delete) and omitted for collection operations (like List, Create).

## Understanding the Components

### Group (`<group>`)

Groups organize related functionality into logical collections. For example `dashboard.grafana.app` will be used for all dashboard-related operations.

### Version (`<version>`)

These APIs will also uses semantic versioning with three stability levels:

| Level | Format     | Description                                                                 | Use Case                 | Enabled By Default? |
| ----- | ---------- | --------------------------------------------------------------------------- | ------------------------ | ------------------- |
| Alpha | `v1alpha1` | Early development stage. Unstable, may contain bugs, and subject to removal | For testing new features | No                  |
| Beta  | `v1beta1`  | More stable than alpha, but may still have some changes                     | For early production use | No                  |
| GA    | `v1`       | Generally Available. Stable with backward compatibility guarantees          | For production use       | Yes                 |

#### Alpha 

Alpha versions should not be served unless explicitly enabled by a feature flag, and should be considered completely experimental and subject to major changes. 
An Alpha version may undergo breaking changes without adding an additional version, and should not be relied upon by production workflows. 

#### Beta

Beta versions should not contain breaking changes in the schema, but still may be subject to changes in handling logic or semantics. 
Breaking schema changes require a new published beta version (such as publishing `v1beta2` for breaking changes to the `v1beta1` schema).
While beta versions are no longer considered experimental like alpha versions, they should still be disabled by default and require a feature flag to enable. 

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

Represents the core resource you want to interact with, such as:

- `dashboards`
- `playlists`
- `folders`

### Name (<name>)

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
