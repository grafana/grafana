---
aliases:
  - ../../http_api/folder/
canonical: /docs/grafana/latest/developers/http_api/folder/
description: Grafana Folder HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - folder
labels:
  products:
    - enterprise
    - oss
title: Folder HTTP API
---

# New Folders APIs

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

> To view more about the new api structure, refer to [API overview]({{< ref "apis" >}}).

### Get all folders

`GET /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders`

Returns all folders that the authenticated user has permission to view within the given organization. Use the `limit` query parameter to control the maximum number of dashboards returned. To retrieve additional dashboards, utilize the `continue` token provided in the response to fetch the next page.

- namespace: to read more about the namespace to use, see the [API overview]({{< ref "apis" >}}).

**Required permissions**

See note in the [introduction]({{< ref "#folder-api" >}}) for an explanation.

| Action         | Scope       |
| -------------- | ----------- |
| `folders:read` | `folders:*` |

**Example Request**:

```http
GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders?limit=1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "kind": "FolderList",
  "apiVersion": "folder.grafana.app/v1beta1",
  "metadata": {
    "continue": "org:1/start:1158/folder:"
  },
  "items": [
    {
      "kind": "Folder",
      "apiVersion": "folder.grafana.app/v1beta1",
      "metadata": {
        "name": "aef30vrzxs3y8d",
        "namespace": "default",
        "uid": "KCtv1FXDsJmTYQoTgcPnfuwZhDZge3uMpXOefaOHjb4X",
        "resourceVersion": "1741343686000",
        "creationTimestamp": "2025-03-07T10:34:46Z",
        "annotations": {
          "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedTimestamp": "2025-03-07T10:34:46Z"
        }
      },
      "spec": {
        "title": "example"
      }
    }
  ]
}
```

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access Denied

### Get folder by uid

`GET /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:uid`

Will return the folder given the folder uid.

- namespace: to read more about the namespace to use, see the [API overview]({{< ref "apis" >}}).
- uid: the unique identifier of the folder to update. this will be the _name_ in the folder response

**Required permissions**

See note in the [introduction]({{< ref "#folder-api" >}}) for an explanation.

| Action         | Scope       |
| -------------- | ----------- |
| `folders:read` | `folders:*` |

**Example Request**:

```http
GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders/aef30vrzxs3y8d HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "kind": "Folder",
  "apiVersion": "folder.grafana.app/v1beta1",
  "metadata": {
    "name": "aef30vrzxs3y8d",
    "namespace": "default",
    "uid": "KCtv1FXDsJmTYQoTgcPnfuwZhDZge3uMpXOefaOHjb4X",
    "resourceVersion": "1741343686000",
    "creationTimestamp": "2025-03-07T10:34:46Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2025-03-07T10:34:46Z",
      "grafana.app/folder": "fef30w4jaxla8b"
    }
  },
  "spec": {
    "title": "test"
  }
}
```

Note the annotation `grafana.app/folder` which contains the uid of the parent folder.

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access Denied
- **404** – Folder not found

### Create folder

`POST /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders`

Creates a new folder.

- namespace: to read more about the namespace to use, see the [API overview]({{< ref "apis" >}}).

**Required permissions**

See note in the [introduction]({{< ref "#folder-api" >}}) for an explanation.

`folders:create` allows creating folders and subfolders. If granted with scope `folders:uid:general`, allows creating root level folders. Otherwise, allows creating subfolders under the specified folders.

| Action           | Scope       |
| ---------------- | ----------- |
| `folders:create` | `folders:*` |
| `folders:write`  | `folders:*` |

**Example Request**:

```http
POST /apis/folder.grafana.app/v1beta1/namespaces/default/folders HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "metadata": {
    "name": "aef30vrzxs3y8d",
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b"
    }
  }
  "spec": {
    "title": "child-folder"
  },
}
```

JSON Body schema:

- **metadata.name** – The Grafana [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}). If you do not want to provide this, set metadata.generateName to the prefix you would like for the uid.
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the parent folder under which the folder should be created. Requires nested folders to be enabled.
- **spec.title** – The title of the folder.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "kind": "Folder",
  "apiVersion": "folder.grafana.app/v1beta1",
  "metadata": {
    "name": "eef33r1fprd34d",
    "namespace": "default",
    "uid": "X8momvVZnsXdOqvLD9I4ngqLVif2CgRWXHy9xb2UgjQX",
    "resourceVersion": "1741320415009",
    "creationTimestamp": "2025-03-07T04:06:55Z",
    "labels": {
      "grafana.app/deprecatedInternalID": "1159"
    },
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b",
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb"
    }
  },
  "spec": {
    "title": "child-folder"
  }
}
```

Status Codes:

- **201** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (folder with the same uid already exists)

### Update folder

`PUT /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:uid`

Updates an existing folder identified by uid.

- namespace: to read more about the namespace to use, see the [API overview]({{< ref "apis" >}}).
- uid: the unique identifier of the folder to update. this will be the _name_ in the folder response

**Required permissions**

See note in the [introduction]({{< ref "#folder-api" >}}) for an explanation.

| Action          | Scope       |
| --------------- | ----------- |
| `folders:write` | `folders:*` |

**Example Request**:

```http
PUT /apis/folder.grafana.app/v1beta1/namespaces/default/folders/fef30w4jaxla8b HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

"metadata": {
    "name": "aef30vrzxs3y8d",
    "annotations": {
      "grafana.app/folder": "xkj92m5pqw3vn4"
    }
  }
  "spec": {
    "title": "updated title"
  },
```

JSON Body schema:

- **metadata.name** – The [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}) of the folder.
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the parent folder under which the folder should be - update this to move the folder under a different parent folder. Requires nested folders to be enabled.
- **spec.title** – The title of the folder.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Folder",
  "apiVersion": "folder.grafana.app/v1beta1",
  "metadata": {
    "name": "fef30w4jaxla8b",
    "namespace": "default",
    "uid": "YaWLsFrMwEaTlIQwX2iMnhHlJuZHtZugps50BQoyjXEX",
    "resourceVersion": "1741345736000",
    "creationTimestamp": "2025-03-07T11:08:56Z",
    "annotations": {
      "grafana.app/folder": "xkj92m5pqw3vn4",
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2025-03-07T11:08:56Z"
    }
  },
  "spec": {
    "title": "updated title"
  }
}
```

Status Codes:

- **200** – Updated
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access Denied
- **404** – Folder not found
- **412** – Precondition failed (the folder has been changed by someone else). With this status code, the response body will have the following properties:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "The folder has been changed by someone else",
  "status": "version-mismatch"
}
```

### Delete folder

`DELETE /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:uid`

Deletes an existing folder identified by UID along with all dashboards (and their alerts) stored in the folder. This operation cannot be reverted.

If [Grafana Alerting]({{< relref "/docs/grafana/latest/alerting" >}}) is enabled, you can set an optional query parameter `forceDeleteRules=false` so that requests will fail with 400 (Bad Request) error if the folder contains any Grafana alerts. However, if this parameter is set to `true` then it will delete any Grafana alerts under this folder.

- namespace: to read more about the namespace to use, see the [API overview]({{< ref "apis" >}}).
- uid: the unique identifier of the folder to delete. this will be the _name_ in the folder response

**Required permissions**

See note in the [introduction]({{< ref "#folder-api" >}}) for an explanation.

| Action           | Scope       |
| ---------------- | ----------- |
| `folders:delete` | `folders:*` |

**Example Request**:

```http
DELETE /apis/folder.grafana.app/v1beta1/namespaces/default/folders/fef30w4jaxla8b HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Folder",
  "apiVersion": "folder.grafana.app/v1beta1",
  "metadata": {
    "name": "fef30w4jaxla8b",
    "namespace": "default",
    "uid": "YaWLsFrMwEaTlIQwX2iMnhHlJuZHtZugps50BQoyjXEX",
    "resourceVersion": "1741345736000",
    "creationTimestamp": "2025-03-07T11:08:56Z",
    "annotations": {
      "grafana.app/folder": "xkj92m5pqw3vn4",
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2025-03-07T11:08:56Z"
    }
  },
  "spec": {
    "title": "updated title"
  }
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **400** – Bad Request
- **403** – Access Denied
- **404** – Folder not found

## APIs

## Identifier (id) vs unique identifier (uid)

The unique identifier (uid) of a folder can be used for uniquely identify folders within an org. It's automatically generated if not provided when creating a folder. The uid allows having consistent URLs for accessing folders and when syncing folders between multiple Grafana installs. This means that changing the title of a folder will not break any bookmarked links to that folder.

The uid can have a maximum length of 40 characters.

The identifier (id) of a folder is deprecated in favor of the unique identifier (uid).

### Get all folders

`GET /api/folders`

Returns all folders that the authenticated user has permission to view. You can control the maximum number of folders returned through the `limit` query parameter, the default is 1000. You can also pass the `page` query parameter for fetching folders from a page other than the first one.

If nested folders are enabled, the operation expects an additional optional query parameter `parentUid` with the parent folder UID, and returns the immediate subfolders that the authenticated user has permission to view.
If the parameter is not supplied, then the operation returns immediate subfolders under the root
that the authenticated user has permission to view.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

| Action         | Scope       |
| -------------- | ----------- |
| `folders:read` | `folders:*` |

**Example Request**:

```http
GET /api/folders?limit=10 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id":1,
    "uid": "nErXDvCkzz",
    "title": "Department ABC"
  },
  {
    "id":2,
    "uid": "k3S1cklGk",
    "title": "Department RND"
  }
]
```

### Get folder by uid

`GET /api/folders/:uid`

Will return the folder given the folder uid.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

| Action         | Scope       |
| -------------- | ----------- |
| `folders:read` | `folders:*` |

**Example Request**:

```http
GET /api/folders/nErXDvCkzzh HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "uid": "nErXDvCkzz",
  "title": "Department ABC",
  "url": "/dashboards/f/nErXDvCkzz/department-abc",
  "hasAcl": false,
  "canSave": true,
  "canEdit": true,
  "canAdmin": true,
  "createdBy": "admin",
  "created": "2018-01-31T17:43:12+01:00",
  "updatedBy": "admin",
  "updated": "2018-01-31T17:43:12+01:00",
  "version": 1
}
```

If nested folders are enabled, and the folder is nested (lives under another folder), then the response additionally contains:

- **parentUid** - The parent folder UID.
- **parents** - An array with the whole tree hierarchy, starting from the root going down up to the parent folder.

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access Denied
- **404** – Folder not found

### Create folder

`POST /api/folders`

Creates a new folder.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

`folders:create` allows creating folders and subfolders. If granted with scope `folders:uid:general`, allows creating root level folders. Otherwise, allows creating subfolders under the specified folders.

| Action           | Scope       |
| ---------------- | ----------- |
| `folders:create` | `folders:*` |
| `folders:write`  | `folders:*` |

**Example Request**:

```http
POST /api/folders HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "uid": "nErXDvCkzz",
  "title": "Department ABC",
  "parentUid": "fgnj5e52gel76g"
}
```

JSON Body schema:

- **uid** – Optional [unique identifier](#identifier-id-vs-unique-identifier-uid).
- **title** – The title of the folder.
- **parentUid** - Optional field, the unique identifier of the parent folder under which the folder should be created. Requires nested folders to be enabled.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "uid": "nErXDvCkzz",
  "title": "Department ABC",
  "url": "/dashboards/f/nErXDvCkzz/department-abc",
  "hasAcl": false,
  "canSave": true,
  "canEdit": true,
  "canAdmin": true,
  "createdBy": "admin",
  "created": "2018-01-31T17:43:12+01:00",
  "updatedBy": "admin",
  "updated": "2018-01-31T17:43:12+01:00",
  "version": 1
}
```

If nested folders are enabled, and the folder is nested (lives under another folder) then the response additionally contains:

- **parentUid** - the parent folder UID.
- **parents** - an array with the whole tree hierarchy starting from the root going down up to the parent folder.

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access Denied
- **412** - Folder already exists

### Update folder

`PUT /api/folders/:uid`

Updates an existing folder identified by uid.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

| Action          | Scope       |
| --------------- | ----------- |
| `folders:write` | `folders:*` |

**Example Request**:

```http
PUT /api/folders/nErXDvCkzz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "title":"Department DEF",
  "version": 1
}
```

JSON Body schema:

- **title** – The title of the folder.
- **version** – Provide the current version to be able to update the folder. Not needed if `overwrite=true`.
- **overwrite** – Set to true if you want to overwrite existing folder with newer version.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "uid": "nErXDvCkzz",
  "title": "Department DEF",
  "url": "/dashboards/f/nErXDvCkzz/department-def",
  "hasAcl": false,
  "canSave": true,
  "canEdit": true,
  "canAdmin": true,
  "createdBy": "admin",
  "created": "2018-01-31T17:43:12+01:00",
  "updatedBy": "admin",
  "updated": "2018-01-31T17:43:12+01:00",
  "version": 1
}
```

If nested folders are enabled, and the folder is nested (lives under another folder) then the response additionally contains:

- **parentUid** - the parent folder UID.
- **parents** - an array with the whole tree hierarchy starting from the root going down up to the parent folder.

Status Codes:

- **200** – Updated
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access Denied
- **404** – Folder not found
- **412** – Precondition failed

The **412** status code is used for explaining that you cannot update the folder and why.
There can be different reasons for this:

- The folder has been changed by someone else, `status=version-mismatch`

The response body will have the following properties:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "The folder has been changed by someone else",
  "status": "version-mismatch"
}
```

### Delete folder

`DELETE /api/folders/:uid`

Deletes an existing folder identified by UID along with all dashboards (and their alerts) stored in the folder. This operation cannot be reverted.

If [Grafana Alerting](/docs/grafana/latest/alerting/) is enabled, you can set an optional query parameter `forceDeleteRules=false` so that requests will fail with 400 (Bad Request) error if the folder contains any Grafana alerts. However, if this parameter is set to `true` then it will delete any Grafana alerts under this folder.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

| Action           | Scope       |
| ---------------- | ----------- |
| `folders:delete` | `folders:*` |

**Example Request**:

```http
DELETE /api/folders/nErXDvCkzz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message":"Folder deleted",
  "id": 2
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **400** – Bad Request
- **403** – Access Denied
- **404** – Folder not found

### Move folder

`POST /api/folders/:uid/move`

Moves the folder.

This is relevant only if nested folders are enabled.

**Required permissions**

See note in the [introduction](#folder-api) for an explanation.

If moving the folder under another folder:

| Action           | Scope                                                 |
| ---------------- | ----------------------------------------------------- |
| `folders:create` | `folders:uid:<destination folder UID>`<br>`folders:*` |

If moving the folder under root:
| Action | Scope |
| -------------- | ------------- |
| `folders:create` | `folders:uid:general`<br>`folders:*` |

JSON body schema:

- **parentUid** – Optional [unique identifier](#identifier-id-vs-unique-identifier-uid) of the new parent folder. If this is empty, then the folder is moved under the root.

**Example Request**:

```http
POST /api/folders/a5393ec3-5568-4e88-8809-b866968ae8a6/move HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "parentUid": "d80b18c0-266a-4aa4-ad5d-5537a00cb8e8",
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"id": 4,
	"uid": "a5393ec3-5568-4e88-8809-b866968ae8a6",
	"title": "just-testing",
	"url": "/dashboards/f/a5393ec3-5568-4e88-8809-b866968ae8a6/just-testing",
	"hasAcl": false,
	"canSave": true,
	"canEdit": true,
	"canAdmin": true,
	"canDelete": true,
	"createdBy": "Anonymous",
	"created": "2023-04-27T21:55:01.593741+03:00",
	"updatedBy": "Anonymous",
	"updated": "2023-04-27T21:55:15.747444+03:00",
	"parentUid": "d80b18c0-266a-4aa4-ad5d-5537a00cb8e8",
	"parents": [
		{
			"id": 2,
			"uid": "d80b18c0-266a-4aa4-ad5d-5537a00cb8e8",
			"title": "f0",
			"url": "",
			"hasAcl": false,
			"canSave": true,
			"canEdit": true,
			"canAdmin": true,
			"canDelete": true,
			"createdBy": "Anonymous",
			"created": "2023-04-27T21:53:46.070672+03:00",
			"updatedBy": "Anonymous",
			"updated": "2023-04-27T21:53:46.070673+03:00"
		}
	]
}
```

Status Codes:

- **200** – Moved
- **400** – Errors (invalid JSON, missing or invalid fields, and so on)
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
