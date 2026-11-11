---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/preferences/
description: Grafana Preferences HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - preferences
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Preferences HTTP API
weight: 100
---

# Preferences HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.2 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Preferences API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/preferences/) is still available, and removal will be announced well in advance to avoid disruptions. Refer to [Migrate from the legacy Preferences API](#migrate-from-the-legacy-preferences-api) to learn more about how both APIs match, and how to migrate.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [preferences.grafana.app/v1](https://play.grafana.org/swagger?api=preferences.grafana.app-v1) in Swagger.**

{{< /admonition >}}

Use this API to read and change user, team, and organization preferences, such as the theme, timezone, home dashboard, and language.

All paths use the `preferences.grafana.app` group and the `v1` version. Replace `{namespace}` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Requirements

Access depends on who owns the preferences, not on role-based access control actions:

| Owner        | Read                                                     | Create, update, and delete             |
| ------------ | -------------------------------------------------------- | -------------------------------------- |
| User         | The user                                                 | The user                               |
| Team         | Team members, and users with permission to read the team | Users with permission to edit the team |
| Organization | Any user in the organization                             | Users with the Admin organization role |

Organization administrators can't read or change the preferences of other users.

## Endpoints

The following table lists the main endpoints. The Swagger documentation also includes the parameters for watching changes.

| Method | Summary                                           | URI                                                                          |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | [Get merged preferences](#get-merged-preferences) | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/merged` |
| GET    | [List preferences](#list-preferences)             | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences`        |
| GET    | [Get preferences](#get-preferences)               | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}` |
| POST   | [Create preferences](#create-preferences)         | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences`        |
| PUT    | [Update preferences](#update-preferences)         | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}` |
| PATCH  | [Patch preferences](#patch-preferences)           | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}` |
| DELETE | [Delete preferences](#delete-preferences)         | `/apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}` |

## Preference names and precedence

Each preferences object belongs to a user, a team, or the whole organization. Its name, `metadata.name`, identifies the owner:

| Owner        | Name              | Example         |
| ------------ | ----------------- | --------------- |
| User         | `user-{user_uid}` | `user-a1b2c3d4` |
| Team         | `team-{team_uid}` | `team-ef5gh6ij` |
| Organization | `namespace`       | `namespace`     |

`{user_uid}` and `{team_uid}` are UIDs, not numeric IDs or logins. To get your user UID, use the `uid` field returned by `GET /api/user`.

When Grafana applies preferences, it uses the first value set for each field, in this order:

1. The user preferences.
1. The preferences of the user's teams, in team UID order. Grafana only considers the first 25 teams.
1. The organization preferences.
1. The defaults in the Grafana configuration.

To get the result, use [Get merged preferences](#get-merged-preferences).

## Preferences fields

The `spec` of a preferences object has the following fields. All fields are optional. A field that isn't set falls back to the next level, as described in [Preference names and precedence](#preference-names-and-precedence).

- **theme** – The interface theme. For example, `light`, `dark`, or `system`. An empty string uses the default.
- **timezone** – A valid IANA timezone, such as `America/New_York` or `Europe/London`, `utc`, `browser`, or an empty string.
- **weekStart** – The first day of the week, in lowercase. For example, `monday`.
- **language** – The interface language. For example, `en-US`.
- **homeDashboardUID** – The UID of the home dashboard. The reserved value `global-home` uses the instance default home page instead of the home dashboard set at a lower level. An empty string clears the preference.
- **navbar.bookmarkUrls** – The URLs bookmarked in the navigation menu.
- **queryHistory.homeTab** – The default tab of the Explore query history: `query`, `starred`, or an empty string.
- **homeURL** – Read-only. The home URL from the `home_page` setting in the Grafana configuration. You can't set it through the API.

## Get merged preferences

`GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/merged`

Returns the preferences that apply to you, after combining your user, team, and organization preferences with the configured defaults.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: None. The response only includes the preferences that apply to you.

### Example request

The following example shows a request to get merged preferences:

```http
GET /apis/preferences.grafana.app/v1/namespaces/default/preferences/merged HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Preferences",
  "apiVersion": "preferences.grafana.app/v1",
  "metadata": {
    "resourceVersion": "1762327800000",
    "creationTimestamp": "2026-11-05T07:30:00Z",
    "annotations": {
      "preferences.grafana.app/source": "user-a1b2c3d4,namespace"
    }
  },
  "spec": {
    "theme": "dark",
    "timezone": "utc",
    "weekStart": "monday",
    "language": "en-US",
    "homeDashboardUID": "jcIIG-07z"
  }
}
```

The `preferences.grafana.app/source` annotation lists the preferences objects that were combined, from highest to lowest precedence. The `resourceVersion` changes when any of them changes.

### Status codes

- **200:** OK
- **401:** Unauthorized

## List preferences

`GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences`

Returns the preferences objects that apply to you: your user preferences, the preferences of your first 25 teams, and the organization preferences. Objects that don't exist aren't included. Service accounts only get the organization preferences.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`fieldSelector`** (optional): Use `metadata.name=<NAME>` to get a single preferences object. No other field selector is supported.

The API doesn't support pagination with `continue`, or filtering with `labelSelector`.

**Required permissions**: None. The response only includes the preferences you can read.

### Example request

The following example shows a request to list preferences:

```http
GET /apis/preferences.grafana.app/v1/namespaces/default/preferences HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "PreferencesList",
  "apiVersion": "preferences.grafana.app/v1",
  "metadata": {},
  "items": [
    {
      "kind": "Preferences",
      "apiVersion": "preferences.grafana.app/v1",
      "metadata": {
        "name": "user-a1b2c3d4",
        "namespace": "default",
        "resourceVersion": "1762327800000",
        "creationTimestamp": "2026-11-05T07:30:00Z"
      },
      "spec": {
        "theme": "dark",
        "homeDashboardUID": "jcIIG-07z"
      }
    },
    {
      "kind": "Preferences",
      "apiVersion": "preferences.grafana.app/v1",
      "metadata": {
        "name": "namespace",
        "namespace": "default",
        "resourceVersion": "1762320000000",
        "creationTimestamp": "2026-11-05T05:20:00Z"
      },
      "spec": {
        "timezone": "utc",
        "weekStart": "monday"
      }
    }
  ]
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized

## Get preferences

`GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}`

Returns the preferences object with the given name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-{user_uid}`, `team-{team_uid}`, or `namespace`.

**Required permissions**: Read access for the owner. Refer to [Requirements](#requirements).

### Example request

The following example shows a request to get preferences:

```http
GET /apis/preferences.grafana.app/v1/namespaces/default/preferences/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Preferences",
  "apiVersion": "preferences.grafana.app/v1",
  "metadata": {
    "name": "user-a1b2c3d4",
    "namespace": "default",
    "resourceVersion": "1762327800000",
    "creationTimestamp": "2026-11-05T07:30:00Z"
  },
  "spec": {
    "theme": "dark",
    "homeDashboardUID": "jcIIG-07z"
  }
}
```

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** No preferences are saved for this owner

## Create preferences

`POST /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences`

Creates the preferences for a user, a team, or the organization. You can also use [Update preferences](#update-preferences), which creates the object if it doesn't exist yet.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: Write access for the owner. Refer to [Requirements](#requirements).

### Example request

The following example shows a request to create preferences:

```http
POST /apis/preferences.grafana.app/v1/namespaces/default/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "team-ef5gh6ij"
  },
  "spec": {
    "theme": "light",
    "homeDashboardUID": "jcIIG-07z"
  }
}
```

JSON body schema:

- **metadata.name** – Required. `user-{user_uid}`, `team-{team_uid}`, or `namespace`.
- **spec** – The preferences. For details, refer to [Preferences fields](#preferences-fields).

### Example response

The following example shows the response:

```http
HTTP/1.1 201
Content-Type: application/json

{
  "kind": "Preferences",
  "apiVersion": "preferences.grafana.app/v1",
  "metadata": {
    "name": "team-ef5gh6ij",
    "namespace": "default",
    "resourceVersion": "1762328000000",
    "creationTimestamp": "2026-11-05T07:33:20Z"
  },
  "spec": {
    "theme": "light",
    "homeDashboardUID": "jcIIG-07z"
  }
}
```

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **422:** Invalid preferences, for example an unknown theme or timezone, or a `homeURL` value

## Update preferences

`PUT /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}`

Replaces the preferences with the given name. If no preferences exist for the owner yet, Grafana creates them. Fields you omit are cleared, so they fall back to the next level.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-{user_uid}`, `team-{team_uid}`, or `namespace`.

**Required permissions**: Write access for the owner. Refer to [Requirements](#requirements).

### Example request

The following example shows a request to update preferences:

```http
PUT /apis/preferences.grafana.app/v1/namespaces/default/preferences/namespace HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "namespace"
  },
  "spec": {
    "theme": "",
    "timezone": "utc",
    "weekStart": "monday",
    "homeDashboardUID": "jcIIG-07z"
  }
}
```

JSON body schema:

- **metadata.name** – Required. It must match `name` in the path.
- **metadata.resourceVersion** – Optional. The resource version you're updating. If the preferences changed since you read them, the request fails with `409`.
- **spec** – The complete preferences. For details, refer to [Preferences fields](#preferences-fields).

The response contains the updated preferences.

### Example response

The response contains the updated preferences. For an example, refer to the response in [Get preferences](#get-preferences).

### Status codes

- **200:** Updated
- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **409:** Conflict (the preferences changed since you read them)
- **422:** Invalid preferences, for example an unknown theme or timezone, or a `homeURL` value

## Patch preferences

`PATCH /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}`

Updates one or more preferences without changing the others. If no preferences exist for the owner yet, Grafana creates them.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-{user_uid}`, `team-{team_uid}`, or `namespace`.

**Required permissions**: Write access for the owner. Refer to [Requirements](#requirements).

### Example request

The following example shows a request to patch preferences:

```http
PATCH /apis/preferences.grafana.app/v1/namespaces/default/preferences/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Content-Type: application/merge-patch+json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "spec": {
    "theme": "dark"
  }
}
```

### Example response

The response contains the updated preferences. For an example, refer to the response in [Get preferences](#get-preferences).

### Status codes

- **200:** Updated
- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **422:** Invalid preferences, for example an unknown theme or timezone, or a `homeURL` value

## Delete preferences

`DELETE /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/{name}`

Deletes the preferences with the given name. After that, every field falls back to the next level.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-{user_uid}`, `team-{team_uid}`, or `namespace`.

**Required permissions**: Write access for the owner. Refer to [Requirements](#requirements).

### Example request

The following example shows a request to delete preferences:

```http
DELETE /apis/preferences.grafana.app/v1/namespaces/default/preferences/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The response contains a `Status` object that confirms the deletion.

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied
- **404:** No preferences are saved for this owner

## Migrate from the legacy Preferences API

The legacy API has separate endpoints for the current user, the current organization, and teams. The new API uses one resource, and the name selects the owner:

| Legacy endpoint                      | New endpoint                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET /api/user/preferences`          | `GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{user_uid}`   |
| `PUT /api/user/preferences`          | `PUT /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{user_uid}`   |
| `PATCH /api/user/preferences`        | `PATCH /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{user_uid}` |
| `GET /api/org/preferences`           | `GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace`         |
| `PUT /api/org/preferences`           | `PUT /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace`         |
| `PATCH /api/org/preferences`         | `PATCH /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace`       |
| `GET /api/teams/:teamId/preferences` | `GET /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/team-{team_uid}`   |
| `PUT /api/teams/:teamId/preferences` | `PUT /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/team-{team_uid}`   |

When you migrate, consider the following differences:

- **Team preferences:** The legacy [team preferences endpoints](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team/) use the numeric team ID. The new API uses the team UID.
- **Home dashboard:** `homeDashboardId` isn't available. Use `homeDashboardUID`.
- **Effective preferences:** The legacy API has no equivalent of [Get merged preferences](#get-merged-preferences).
- **Responses:** Updates return the saved preferences object instead of a `{"message":"Preferences updated"}` message.
