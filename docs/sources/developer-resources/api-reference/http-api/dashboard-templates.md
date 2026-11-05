---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/dashboard-templates/
description: Grafana Dashboard templates HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
  - templates
labels:
  products:
    - enterprise
    - cloud
title: Dashboard templates HTTP API
weight: 100
---

# Dashboard templates HTTP API

{{< admonition type="note" >}}
This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashboardtemplates.grafana.app/v1alpha1](https://play.grafana.org/swagger?api=dashboardtemplates.grafana.app-v1alpha1) in Swagger.**
{{< /admonition >}}

Use this API to manage custom dashboard templates. A dashboard template stores a dashboard that users in your organization can use as a starting point for new dashboards. Each template has its own title, description, tags, and preview image, which Grafana shows in the template gallery.

All paths use the `dashboardtemplates.grafana.app` group and the `v1alpha1` version. Replace `:namespace` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Before you begin

**This API is experimental (`v1alpha1`) and might change**. For more details about versioning, refer to [New API versioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis#version).

Custom dashboard templates are only available in Grafana Enterprise and Grafana Cloud. The feature is disabled by default. To enable it in Grafana Enterprise, turn on the `grafana.customDashboardTemplates` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Requirements

You need the following permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Operation                  | Action                     |
| -------------------------- | -------------------------- |
| Get and list               | `dashboardtemplates:read`  |
| Create, update, and delete | `dashboardtemplates:write` |

## Endpoints

The following table lists the main endpoints. The Swagger documentation also includes endpoints to delete a collection of templates, apply partial updates with `PATCH`, and read or update the `status` subresource.

| Method | URI                                                                                          | Summary                                                     |
| ------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| GET    | /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates       | [List dashboard templates](#list-dashboard-templates)       |
| GET    | /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name | [Get a dashboard template](#get-a-dashboard-template)       |
| POST   | /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates       | [Create a dashboard template](#create-a-dashboard-template) |
| PUT    | /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name | [Update a dashboard template](#update-a-dashboard-template) |
| DELETE | /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name | [Delete a dashboard template](#delete-a-dashboard-template) |

## List dashboard templates

`GET /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates`

Returns the dashboard templates in the organization. Use the `limit` query parameter to control the maximum number of templates returned. To retrieve more templates, use the `continue` token from the response to fetch the next page.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of templates to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.

The API doesn't filter templates by tag. To filter by tag, filter the list response on the client.

**Required permissions**: `dashboardtemplates:read`

**Example request**:

```http
GET /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/default/dashboardtemplates?limit=1 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "DashboardTemplateList",
  "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
  "metadata": {
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "DashboardTemplate",
      "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
      "metadata": {
        "name": "service-overview",
        "namespace": "default",
        "uid": "9c1e2f3a-4b5d-4e6f-8a7b-1c2d3e4f5a6b",
        "resourceVersion": "1762325460000",
        "creationTimestamp": "2026-11-05T06:51:00Z",
        "annotations": {
          "grafana.app/createdBy": "user:u000000001"
        }
      },
      "spec": {
        "title": "Service overview",
        "description": "Request rate, errors, and latency for a single service",
        "tags": ["red", "services"],
        "dashboardVersion": "dashboard.grafana.app/v2beta1",
        "dashboard": {
          "title": "Service overview",
          "elements": {},
          "layout": {
            "kind": "AutoGridLayout",
            "spec": {
              "items": []
            }
          }
        }
      }
    }
  ]
}
```

The example shortens the `dashboard` object. A real template contains the full dashboard spec.

Continue making requests with the updated `continue` token until you receive a response without a `continue` field in the metadata, which means you've reached the last page.

Status codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied

## Get a dashboard template

`GET /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name`

Returns the dashboard template with the given name.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The unique identifier of the template. This is the `metadata.name` field in the template response.

**Required permissions**: `dashboardtemplates:read`

**Example request**:

```http
GET /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/default/dashboardtemplates/service-overview HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "DashboardTemplate",
  "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
  "metadata": {
    "name": "service-overview",
    "namespace": "default",
    "uid": "9c1e2f3a-4b5d-4e6f-8a7b-1c2d3e4f5a6b",
    "resourceVersion": "1762325460000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "user:u000000001"
    }
  },
  "spec": {
    "title": "Service overview",
    "description": "Request rate, errors, and latency for a single service",
    "tags": ["red", "services"],
    "previewImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "dashboardVersion": "dashboard.grafana.app/v2beta1",
    "dashboard": {
      "title": "Service overview",
      "elements": {},
      "layout": {
        "kind": "AutoGridLayout",
        "spec": {
          "items": []
        }
      }
    }
  }
}
```

Status codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access denied
- **404** – Template not found

## Create a dashboard template

`POST /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates`

Creates a dashboard template.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: `dashboardtemplates:write`

**Example request**:

```http
POST /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/default/dashboardtemplates HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "generateName": "service-"
  },
  "spec": {
    "title": "Service overview",
    "description": "Request rate, errors, and latency for a single service",
    "tags": ["red", "services"],
    "dashboardVersion": "dashboard.grafana.app/v2beta1",
    "dashboard": {
      "title": "Service overview",
      "elements": {},
      "layout": {
        "kind": "AutoGridLayout",
        "spec": {
          "items": []
        }
      }
    }
  }
}
```

JSON body schema:

- **metadata.name** – The unique identifier of the template. If you don't want to provide one, set `metadata.generateName` to the prefix you want, and Grafana generates the rest of the name.
- **spec.title** – The title of the template, shown in the template gallery. It's independent from the title of the embedded dashboard.
- **spec.description** – Optional. The description of the template, shown in the template gallery. It's independent from the description of the embedded dashboard.
- **spec.tags** – Tags to filter templates in the template gallery. Use an empty list if you don't want tags.
- **spec.dashboardVersion** – The schema version of the embedded dashboard, for example `dashboard.grafana.app/v2beta1`. Grafana validates `spec.dashboard` against this schema.
- **spec.dashboard** – The dashboard to use as a template. It must be valid for the schema in `spec.dashboardVersion`.
- **spec.previewImage** – Optional. A preview image of the dashboard, as a Base64-encoded data URI, for example `data:image/png;base64,...`. Grafana shows it on the template gallery card. When you save a template from the Grafana UI, Grafana captures the preview in the browser.

**Example response**:

```http
HTTP/1.1 201
Content-Type: application/json

{
  "kind": "DashboardTemplate",
  "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
  "metadata": {
    "name": "service-7xkq2",
    "namespace": "default",
    "uid": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    "resourceVersion": "1762325460000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb"
    }
  },
  "spec": {
    "title": "Service overview",
    "description": "Request rate, errors, and latency for a single service",
    "tags": ["red", "services"],
    "dashboardVersion": "dashboard.grafana.app/v2beta1",
    "dashboard": {
      "title": "Service overview",
      "elements": {},
      "layout": {
        "kind": "AutoGridLayout",
        "spec": {
          "items": []
        }
      }
    }
  }
}
```

Status codes:

- **201** – Created
- **400** – Errors (invalid JSON, missing or invalid fields)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (a template with the same name already exists)

## Update a dashboard template

`PUT /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name`

Replaces an existing dashboard template identified by name. Provide the full object, including `metadata.resourceVersion` from the latest version of the template.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The unique identifier of the template.

**Required permissions**: `dashboardtemplates:write`

**Example request**:

```http
PUT /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/default/dashboardtemplates/service-overview HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "DashboardTemplate",
  "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
  "metadata": {
    "name": "service-overview",
    "resourceVersion": "1762325460000"
  },
  "spec": {
    "title": "Service overview (RED)",
    "description": "Request rate, errors, and duration for a single service",
    "tags": ["red", "services", "sre"],
    "dashboardVersion": "dashboard.grafana.app/v2beta1",
    "dashboard": {
      "title": "Service overview",
      "elements": {},
      "layout": {
        "kind": "AutoGridLayout",
        "spec": {
          "items": []
        }
      }
    }
  }
}
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "DashboardTemplate",
  "apiVersion": "dashboardtemplates.grafana.app/v1alpha1",
  "metadata": {
    "name": "service-overview",
    "namespace": "default",
    "uid": "9c1e2f3a-4b5d-4e6f-8a7b-1c2d3e4f5a6b",
    "resourceVersion": "1762325999000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "user:u000000001",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2026-11-05T07:00:00Z"
    }
  },
  "spec": {
    "title": "Service overview (RED)",
    "description": "Request rate, errors, and duration for a single service",
    "tags": ["red", "services", "sre"],
    "dashboardVersion": "dashboard.grafana.app/v2beta1",
    "dashboard": {
      "title": "Service overview",
      "elements": {},
      "layout": {
        "kind": "AutoGridLayout",
        "spec": {
          "items": []
        }
      }
    }
  }
}
```

Status codes:

- **200** – Updated
- **400** – Errors (invalid JSON, missing or invalid fields)
- **401** – Unauthorized
- **403** – Access denied
- **404** – Template not found
- **409** – Conflict (the template changed since you read it)

## Delete a dashboard template

`DELETE /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/:namespace/dashboardtemplates/:name`

Deletes an existing dashboard template identified by name. This operation can't be reverted.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `name`: The unique identifier of the template.

**Required permissions**: `dashboardtemplates:write`

**Example request**:

```http
DELETE /apis/dashboardtemplates.grafana.app/v1alpha1/namespaces/default/dashboardtemplates/service-overview HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "code": 200
}
```

Status codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Template not found
