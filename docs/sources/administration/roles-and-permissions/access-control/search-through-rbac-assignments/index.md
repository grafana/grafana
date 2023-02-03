---
aliases:
  - ../../../enterprise/access-control/search-through-rbac-assignments/
  - ../../../enterprise/access-control/debug-rbac-assignments/
description: Learn how to search and filter RBAC assignments and permissions using the search endpoint.
menuTitle: Search through RBAC assignments
title: Search through RBAC assignments
weight: 50
---

# Search through RBAC assignments (aka debug permission grants)

> **Note**: Available as of Grafana Enterprise 9.4.

This section includes instructions on how to search and filter assignments and permissions using the search endpoint
that was introduced with Grafana 9.4. Refer to the [RBAC HTTP API]({{< relref "../../../../developers/http_api/access_control/#search-through-rbac-assignments" >}}) for more details.

## Limitations

Here are some known limitations of the search endpoint:

1. For dashboard permissions the search endpoint has to be queried twice (on both the folder containing the dashboard and the dashboard itself).
1. The scope filter won't match patterns like `%:DhKdyaR` when the user has a global permission such as `datasources:*`.

## Examples

The endpoint has been designed to be flexible enough to answer a fair amount of RBAC related questions.
In the following sections are example of use cases it covers.

### Which roles have been directly assigned to a user?

Assuming the user ID is `16`. Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "16",
  "onlyRoles": true
}
```

This request can be read as:

```
SEARCH users ASSIGNMENTS OF user "16" SHOW ROLES ONLY
```

### Which roles have been assigned to a user through teams?

Assuming the user ID is `16`. Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "16",
  "teamId": "*",
  "onlyRoles": true
}
```

This request can be read as:

```
SEARCH teams ASSIGNMENTS OF user "16" SHOW ROLES ONLY
```

### Which permissions did a user get through basic roles (Viewer, Editor, Admin, Grafana Admin)?

Assuming the user ID is `16`. Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "16",
  "basicRole": "*",
  "onlyRoles": true
}
```

This request can be read as:

```
SEARCH basic roles ASSIGNMENTS OF user "16" SHOW PERMISSIONS
```

### How did a user get read access to a specific data source?

Assuming the user ID is `16` and the data source UID is `3RrgxsoVk`. Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "16",
  "teamId": "*",
  "basicRole": "*",
  "action": "datasources:read",
  "scope": "datasources:uid:3RrgxsoVk",
  "onlyRoles": false
}
```

This request can be read as:

```
SEARCH users, teams, basic roles ASSIGNMENTS OF user "16" WITH action "datasources:read" ON "datasources:uid:3RrgxsoVk" SHOW PERMISSIONS
```

### Which users can remove a specific dashboard?

Assuming the dashboard UID is `3RrgxsoVk`. Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "*",
  "teamId": "*",
  "basicRole": "*",
  "action": "dashboards:delete",
  "scope": "dashboards:uid:3RrgxsoVk",
  "onlyRoles": false
}
```

This request can be read as:

```
SEARCH users, teams, basic roles ASSIGNMENTS WITH action "dashboards:delete" ON "dashboards:uid:3RrgxsoVk" SHOW PERMISSIONS
```

Note that if the dashboard is inside a folder (ex: `4SshytpWl`), it might be relevant to also check the folder's permissions:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "userId": "*",
  "teamId": "*",
  "basicRole": "*",
  "action": "dashboards:delete",
  "scope": "folders:uid:4SshytpWl",
  "onlyRoles": false
}
```

This request can be read as:

```
SEARCH users, teams, basic roles ASSIGNMENTS WITH action "dashboards:delete" ON "folders:uid:4SshytpWl" SHOW PERMISSIONS
```

### Which teams have been granted data source related roles?

Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "teamId": "*",
  "roleName": "fixed:datasources%",
  "onlyRoles": true
}
```

This request can be read as:

```
SEARCH teams ASSIGNMENTS WITH role "fixed:datasources%" SHOW ROLES ONLY
```

### Which basic roles allow any "users" related action?

Here is the associated request:

```http
POST /api/access-control/assignments/search
Accept: application/json
Content-Type: application/json
```

```json
{
  "basicRole": "*",
  "action": "%users%",
  "onlyRoles": true
}
```

This request can be read as:

```
SEARCH basic roles ASSIGNMENTS WITH action "%users%" SHOW ROLES ONLY
```
