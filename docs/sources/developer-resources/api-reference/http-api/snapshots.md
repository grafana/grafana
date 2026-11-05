---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/snapshots/
description: Grafana Snapshots HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - snapshot
  - snapshots
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Snapshots HTTP API
weight: 100
---

# Snapshots HTTP API

{{< admonition type="note" >}}
This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The Snapshots API replaces the legacy [Snapshot API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/snapshot/). Refer to [Migrate from the legacy Snapshot API](#migrate-from-the-legacy-snapshot-api) to learn how both APIs match.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashboard.grafana.app/v0alpha1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v0alpha1) in Swagger.**
{{< /admonition >}}

Use this API to create, list, view, and delete dashboard snapshots. A snapshot stores a dashboard together with the data its panels showed when you took the snapshot, so you can share it with people who can't access the original data sources.

All paths use the `dashboard.grafana.app` group and the `v0alpha1` version. Replace `:namespace` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Before you begin

**This API is experimental (`v0alpha1`) and might change**. For more details about versioning, refer to [New API versioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis#version).

The API is disabled by default. To enable it, turn on the `snapshots.kubernetesSnapshots` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/). If the feature toggle is off, requests to the endpoints on this page return `403`.

Snapshots must also be enabled in the `[snapshots]` section of the Grafana configuration.

## Requirements

You need the following permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Operation                                   | Action             |
| ------------------------------------------- | ------------------ |
| Get snapshot settings and list snapshots    | `snapshots:read`   |
| Create a snapshot                           | `snapshots:create` |
| Delete a snapshot, by name or by delete key | `snapshots:delete` |

The following rules also apply:

- To create a snapshot of a dashboard, you also need `dashboards:read` on that dashboard.
- When you list snapshots, users without the Admin organization role only get the snapshots they created.
- To delete a snapshot by name, you must also have created it or have `dashboards:write` on the dashboard it was taken from. To delete a snapshot with its delete key, `snapshots:delete` is enough.

Anyone with the link can view a snapshot. Getting a snapshot or its dashboard doesn't require authentication.

## Endpoints

| Method | URI                                                                                    | Summary                                                             |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/settings          | [Get snapshot settings](#get-snapshot-settings)                     |
| POST   | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/create            | [Create a snapshot](#create-a-snapshot)                             |
| GET    | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots                   | [List snapshots](#list-snapshots)                                   |
| GET    | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name             | [Get a snapshot](#get-a-snapshot)                                   |
| GET    | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name/dashboard   | [Get the dashboard of a snapshot](#get-the-dashboard-of-a-snapshot) |
| DELETE | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name             | [Delete a snapshot](#delete-a-snapshot)                             |
| DELETE | /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/delete/:deleteKey | [Delete a snapshot by delete key](#delete-a-snapshot-by-delete-key) |

## Get snapshot settings

`GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/settings`

Returns the snapshot sharing settings of the instance. Use it to check whether snapshots and external snapshots are enabled before you create a snapshot.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: `snapshots:read`

**Example request**:

```http
GET /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/settings HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "snapshotEnabled": true,
  "externalEnabled": true,
  "externalSnapshotURL": "https://snapshots.raintank.io",
  "externalSnapshotName": "Publish to snapshots.raintank.io"
}
```

The response contains the following fields:

- **snapshotEnabled** – Whether snapshots are enabled.
- **externalEnabled** – Whether you can publish snapshots to an external snapshot server.
- **externalSnapshotURL** – The URL of the external snapshot server.
- **externalSnapshotName** – The name of the external snapshot server, as shown in the Grafana UI.
- **publicMode** – Whether snapshots run in public mode. Only returned when `true`.

Status codes:

- **200** – OK
- **400** – The namespace doesn't match your organization
- **401** – Unauthorized
- **403** – Access denied

## Create a snapshot

`POST /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/create`

Creates a snapshot of a dashboard.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: `snapshots:create`, and `dashboards:read` on the dashboard

**Example request**:

```http
POST /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/create HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "name": "Service overview - incident 42",
  "expires": 86400,
  "external": false,
  "dashboard": {
    "uid": "b22ec8db-399b-403b-b6c7-b0fb30ccb2a5",
    "title": "Service overview",
    "schemaVersion": 41,
    "time": {
      "from": "2026-11-05T01:00:00.000Z",
      "to": "2026-11-05T07:00:00.000Z"
    },
    "panels": [
      {
        "id": 1,
        "type": "timeseries",
        "title": "Requests",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [],
        "snapshotData": [
          {
            "refId": "A",
            "fields": [
              { "name": "time", "type": "time", "values": [1762304400000, 1762308000000] },
              { "name": "requests", "type": "number", "values": [120, 135] }
            ]
          }
        ]
      }
    ]
  }
}
```

JSON body schema:

- **dashboard** – Required. The complete dashboard model, in the classic dashboard JSON format, including the data to show in each panel. `dashboard.uid` must be the UID of an existing dashboard that you can read, unless snapshots run in public mode.
- **name** – Optional. The name of the snapshot.
- **expires** – Optional. When the snapshot expires, in seconds. For example, `3600` is one hour and `86400` is one day. The default, `0`, means the snapshot never expires.
- **external** – Optional. Set to `true` to publish the snapshot to the external snapshot server instead of storing it in Grafana. External snapshots must be enabled. The default is `false`.

{{< admonition type="note" >}}
You must provide the full dashboard payload, including the data of each panel in `snapshotData`. This endpoint is designed for the Grafana UI, which collects the panel data when you share a snapshot.
{{< /admonition >}}

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "key": "snapshot-7xkq2",
  "deleteKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "url": "https://grafana.example.com/dashboard/snapshot/snapshot-7xkq2",
  "deleteUrl": "https://grafana.example.com/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

The response contains the following fields:

- **key** – The name of the snapshot. Use it to get or delete the snapshot.
- **deleteKey** – A secret key to delete the snapshot. Grafana only returns it when you create the snapshot, so store it if you need it later.
- **url** – The URL to view the snapshot.
- **deleteUrl** – The URL to delete the snapshot with the delete key.

Status codes:

- **200** – Created
- **400** – Errors (invalid JSON, missing dashboard, missing dashboard UID, dashboard not found, `dryRun` set, or a namespace that doesn't match your organization)
- **401** – Unauthorized
- **403** – Access denied, snapshots are disabled, or external snapshots are disabled

## List snapshots

`GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots`

Returns the snapshots in the organization. Users with the Admin organization role get all snapshots, while other users only get the snapshots they created. Use the `limit` query parameter to control the maximum number of snapshots returned. To retrieve more snapshots, use the `continue` token from the response to fetch the next page.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of snapshots to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.

**Required permissions**: `snapshots:read`

**Example request**:

```http
GET /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots?limit=1 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "SnapshotList",
  "apiVersion": "dashboard.grafana.app/v0alpha1",
  "metadata": {
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "Snapshot",
      "apiVersion": "dashboard.grafana.app/v0alpha1",
      "metadata": {
        "name": "snapshot-7xkq2",
        "namespace": "default",
        "creationTimestamp": "2026-11-05T07:00:00Z"
      },
      "spec": {
        "title": "Service overview - incident 42",
        "expires": 86400,
        "external": false,
        "originalUrl": "https://grafana.example.com/d/b22ec8db-399b-403b-b6c7-b0fb30ccb2a5"
      }
    }
  ]
}
```

The list doesn't include the dashboard of each snapshot. To get it, refer to [Get the dashboard of a snapshot](#get-the-dashboard-of-a-snapshot).

Status codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied

## Get a snapshot

`GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name`

Returns the metadata of the snapshot with the given name. This endpoint doesn't require authentication.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The name of the snapshot. This is the `key` returned when you create the snapshot.

**Example request**:

```http
GET /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/snapshot-7xkq2 HTTP/1.1
Accept: application/json
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Snapshot",
  "apiVersion": "dashboard.grafana.app/v0alpha1",
  "metadata": {
    "name": "snapshot-7xkq2",
    "namespace": "default",
    "creationTimestamp": "2026-11-05T07:00:00Z"
  },
  "spec": {
    "title": "Service overview - incident 42",
    "expires": 86400,
    "external": false,
    "originalUrl": "https://grafana.example.com/d/b22ec8db-399b-403b-b6c7-b0fb30ccb2a5"
  }
}
```

The response contains the following `spec` fields:

- **title** – The name of the snapshot.
- **expires** – When the snapshot expires, in seconds after it was created. `0` means it never expires.
- **external** – Whether the snapshot is stored on an external snapshot server.
- **externalUrl** – The URL of the snapshot on the external snapshot server, for external snapshots.
- **originalUrl** – The URL of the dashboard the snapshot was taken from.

Status codes:

- **200** – Found
- **404** – Snapshot not found

## Get the dashboard of a snapshot

`GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name/dashboard`

Returns the dashboard stored in the snapshot, including the data of each panel. This endpoint doesn't require authentication.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The name of the snapshot.

**Example request**:

```http
GET /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/snapshot-7xkq2/dashboard HTTP/1.1
Accept: application/json
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v0alpha1",
  "metadata": {
    "namespace": "default"
  },
  "spec": {
    "uid": "b22ec8db-399b-403b-b6c7-b0fb30ccb2a5",
    "title": "Service overview",
    "panels": [
      ...
    ],
    ...
  }
}
```

Status codes:

- **200** – Found
- **404** – Snapshot not found

## Delete a snapshot

`DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name`

Deletes the snapshot with the given name. This operation can't be reverted. It might take up to an hour before the snapshot is cleared from CDN caches.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The name of the snapshot.

**Required permissions**: `snapshots:delete`. You must also have created the snapshot or have `dashboards:write` on the dashboard it was taken from.

**Example request**:

```http
DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/snapshot-7xkq2 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

Status codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Snapshot not found

## Delete a snapshot by delete key

`DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/delete/:deleteKey`

Deletes the snapshot that matches the delete key returned when you created it. If the snapshot is stored on an external snapshot server, Grafana also deletes it there. This operation can't be reverted.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `deleteKey`: The `deleteKey` returned when you created the snapshot.

**Required permissions**: `snapshots:delete`

**Example request**:

```http
DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches."
}
```

Status codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – No snapshot matches the delete key

## Migrate from the legacy Snapshot API

The Snapshots API uses different paths and response shapes than the legacy `/api/snapshots` endpoints. The following table shows how the endpoints match:

| Legacy endpoint                        | New endpoint                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `POST /api/snapshots`                  | `POST /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/create`              |
| `GET /api/dashboard/snapshots`         | `GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots`                      |
| `GET /api/snapshots/:key`              | `GET /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name/dashboard`      |
| `DELETE /api/snapshots/:key`           | `DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name`             |
| `GET /api/snapshots-delete/:deleteKey` | `DELETE /apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/delete/:deleteKey` |

When you migrate, consider the following differences:

- **Keys:** You can't set `key` or `deleteKey` when you create a snapshot. Grafana generates both and returns them in the response. The snapshot `key` is its `metadata.name`.
- **Source dashboard:** `dashboard.uid` must refer to an existing dashboard that you can read, unless snapshots run in public mode.
- **Delete by delete key:** The legacy endpoint works without authentication. The new endpoint uses `DELETE` instead of `GET`, and requires authentication and the `snapshots:delete` permission.
- **Get a snapshot:** The legacy endpoint returns the snapshot metadata and dashboard together. The new API returns the metadata from `snapshots/:name` and the dashboard from `snapshots/:name/dashboard`.
- **List:** The legacy `query` search parameter has no equivalent.
- **Settings:** Use `snapshots/settings` to check whether snapshots and external snapshots are enabled.
