---
description: Grafana Group Attribute Sync HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - group
  - member
  - enterprise
labels:
  products:
    - enterprise
    - oss
title: Group Attribute Sync HTTP API
---

# Group attribute sync API

The Group Attribute Sync API allows you to configure [group attribute sync feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-group-attribute-sync). This API is useful when you want to manage user roles based on group membership in an external system.

> **Note:** Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/)

{{% admonition type="note" %}}
This feature is behind the `groupAttributeSync` feature toggle.
You can enable feature toggles through configuration file or environment variables. See configuration [docs](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) for details.
{{% /admonition %}}

## List group mappings

`GET /api/groupsync/groups`

**Required permissions**

| Action                  | Scope |
| ----------------------- | ----- |
| groupsync.mappings:read | n/a   |

**Example Request**:

```http
GET /api/groupsync/groups HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "groups": [
        {
            "groupID": "group 1",
            "mappings": {
                "1": {
                    "roles": [
                        "fixed_nzVQoNSDSn0fg1MDgO6XnZX2RZI",
                        "my_custom_role",
                    ]
                }
            }
        },
        {
            "groupID": "group 2",
            "mappings": {
                "1": {
                    "roles": [
                        "another_role",
                    ]
                }
            }
        }
    ],
    "total": 2
  }
]
```

Status Codes:

- **200** - Ok
- **400** - Bad request
- **401** - Unauthorized
- **403** - Permission denied
- **500** - Internal server error

## Create group mappings

`POST /api/groupsync/groups/:groupID`

**Required permissions**

| Action                   | Scope |
| ------------------------ | ----- |
| groupsync.mappings:write | n/a   |

**Example Request**:

```http
POST /api/groupsync/groups/my_group_id HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
    "roles": [
        "fixed_nzVQoNSDSn0fg1MDgO6XnZX2RZI",
        "my_custom_role_uid"
    ]
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "message": "Group mappings created."
}
```

Status Codes:

- **201** - Ok
- **400** - Bad request
- **401** - Unauthorized
- **403** - Permission denied
- **500** - Internal server error

## Update group mappings

`PUT /api/groupsync/groups/:groupID`

This endpoint will replace the existing mappings for the group with the new mappings provided in the request.

**Required permissions**

| Action                   | Scope |
| ------------------------ | ----- |
| groupsync.mappings:write | n/a   |

**Example Request**:

```http
PUT /api/groupsync/groups/my_group_id HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
    "roles": [
        "fixed_nzVQoNSDSn0fg1MDgO6XnZX2RZI",
        "my_custom_role_uid"
    ]
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "message": "Group mappings set."
}
```

Status Codes:

- **201** - Ok
- **400** - Bad request
- **401** - Unauthorized
- **403** - Permission denied
- **500** - Internal server error

## Remove group mappings

`DELETE /api/groupsync/groups/:groupID`

**Required permissions**

| Action                   | Scope |
| ------------------------ | ----- |
| groupsync.mappings:write | n/a   |

**Example Request**:

```http
DELETE /api/groupsync/groups/my_group_id HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

Status Codes:

- **204** - Ok
- **400** - Bad request
- **401** - Unauthorized
- **403** - Permission denied
- **500** - Internal server error
