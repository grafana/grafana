---
aliases:
  - /docs/grafana-cloud/api-reference/cloud-api/
  - /docs/grafana-cloud/developer-resources/api-reference/cloud-api/
  - /docs/grafana-cloud/reference/cloud-api/
title: Grafana Cloud API
weight: 125
---

# Grafana Cloud API

The Grafana Cloud API, sometimes referred to as the Grafana.com API or GCOM API, allows you to interact with resources from your [Grafana Cloud Stack](/docs/grafana-cloud/account-management/cloud-stacks/) programmatically.

Below is the list of approved, static endpoints and calls for general use. Any other paths are subject to change and are not maintained for general user consumption.

{{< admonition type="note" >}}

If you need to manage or access resources from your Grafana instance—such as dashboards, alerts, data sources, users, and more—refer to the [HTTP API](/docs/grafana-cloud/developer-resources/api-reference/http-api/) instead.

{{< /admonition >}}

## Authentication

You must create a Cloud Access Policy and token to use the Cloud API.
To create a Grafana Cloud Access Policy, refer to [Create an access policy](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/create-access-policies/).

Requests to the API are authenticated using the `Authorization` header:

```http
Authorization: Bearer <CLOUD ACCESS POLICY TOKEN>
```

## Access policies and tokens

{{< admonition type="note" >}}
The rate limit on the Grafana Cloud API endpoint for access policies is 600 per hour.
{{< /admonition >}}

Access policies and tokens use `access policy`, `token`, `scope`, `realm`, `labelselector` and `conditions` resources.
For more information about these resources, refer to [Grafana Cloud Access Policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/).

{{< admonition type="note" >}}
Access policies and tokens must have a unique combination of name, org ID, and region.
{{< /admonition >}}

All API requests must specify a token in the request's `Authorization` header.

This API relies on stack and org IDs, and region:

- Stack ID: get from the `https://grafana.com/api/orgs/{org}/instances` endpoint
- Org ID: get from the `https://grafana.com/api/orgs/{org}` endpoint
- Region: get the region of your stack from the `https://grafana.com/api/orgs/{org}/instances` endpoint or get a list of all the available regions from the `https://grafana.com/api/stack-regions` endpoint

Paginated endpoints optionally accept both `pageSize` and `pageCursor` query parameters.
If you omit the `pageCursor` parameter, or provide an empty `pageCursor` value, you receive the first page.

You can get the next page's URL the current page's `metadata.pagination.nextPage` property.
If that field is `null`, you've reached the last page and there are no records left.

### Create an access policy

Create an access policy with the `POST` method.

```http
POST https://www.grafana.com/api/v1/accesspolicies
```

#### Parameters

| Name     | Type   | Description                                                          | Required |
| -------- | ------ | -------------------------------------------------------------------- | -------- |
| `region` | String | Region for the Access Policy. Generally where the stack is deployed. | Yes      |

#### Request body

| Name          | Type         | Description                                                                                                                                                                                  | Required |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- | --- |
| `name`        | String       | Name of the access policy. It must be 1-255 characters long. Characters can only include lowercase letters from the English alphabet (a-z), numbers (0-9), hyphens (-) and underscores (\_). | Yes      |
| `displayName` | String       | Display name of the access policy, visible in the UI. Set to `name` if not provided. It must be 1-255 characters long.                                                                       | No       |     | No  |
| `scopes`      | List[String] | List of [**scopes**](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#scopes).                                                      | Yes      |
| `realms`      | List[Realm]  | List of [**realms**](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#realms).                                                      | Yes      |
| `conditions`  | Conditions   | A set of criteria that is used to restrict access of the access policy and tokens.                                                                                                           | No       |

**Realm**

| Name            | Type              | Description                                                                                                                                                                                                                    | Required |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `type`          | String            | Type of realm. Can be `org` or `stack`.                                                                                                                                                                                        | Yes      |
| `identifier`    | String            | The unique identifier of a realm (ID of the org or stack depending on the realm type).                                                                                                                                         | Yes      |
| `labelPolicies` | List[LabelPolicy] | List of [label policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#labelpolicy-or-label-selectors). Available only with read permissions for metrics and logs. | No       |

**LabelPolicy**

| Name       | Type   | Description                                                                                                                                                 | Required |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `selector` | String | [Label selector](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#labelpolicy-or-label-selectors). | Yes      |

**Conditions**

| Name             | Type         | Description                                                                                                                                                                                                                                                                 | Required |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `allowedSubnets` | List[String] | An array of IP addresses with subnet masks in CIDR notation (both IPv4 or IPv6 are supported) for [IP range based access control](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#ip-range-based-access-control). | Yes      |

Example request:

```json
{
  "name": "stack-readers",
  "displayName": "Stack Readers",
  "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
  "realms": [
    {
      "type": "stack",
      "identifier": "123",
      "labelPolicies": [
        {
          "selector": "{env != \"dev\"}"
        }
      ]
    }
  ],
  "conditions": {
    "allowedSubnets": ["192.168.0.0/24", "10.1.2.99/32"]
  }
}
```

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "orgId": "1",
  "name": "stack-readers",
  "displayName": "Stack Readers",
  "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
  "realms": [
    {
      "type": "stack",
      "identifier": "123",
      "labelPolicies": [
        {
          "selector": "{env != \"dev\"}"
        }
      ]
    }
  ],
  "conditions": {
    "allowedSubnets": ["192.168.0.0/24", "10.1.2.99/32"]
  },
  "createdAt": "2022-06-08T20:07:21.223Z",
  "updatedAt": "2022-06-08T20:07:21.223Z"
}
```

| Code  | Description                      |
| ----- | -------------------------------- |
| `400` | Bad request                      |
| `401` | API token is missing or invalid. |
| `409` | Conflict                         |

### List access policies

List specified access policies with the `GET` method.

```http
GET https://www.grafana.com/api/v1/accesspolicies
```

#### Parameters

| Name              | Type   | Description                                                                                                                                                                                        | Required |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `name`            | Query  | Name of the access policy to filter by.                                                                                                                                                            | No       |
| `realmType`       | String | Query. Available values are `org` and `stack`.                                                                                                                                                     | No       |
| `realmIdentifier` | String | Requires `realmType`. Identifier of the realm.                                                                                                                                                     | No       |
| `pageSize`        | String | The number of records to be returned per page. The default value is 500; the maximum value is 500.                                                                                                 | No       |
| `pageCursor`      | String | Query. A cursor used for paging through the results. If you omit the `pageCursor` parameter, or provide an empty `pageCursor` value, you receive the first page.                                   | No       |
| `region`          | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `status`          | String | Query. A status that can be used to filter the final list of Access Policies. Available values are `active` and `inactive`.                                                                        | No       |

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "items": [
    {
      "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
      "orgId": "1",
      "name": "stack-readers",
      "displayName": "Stack Readers",
      "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
      "realms": [
        {
          "type": "stack",
          "identifier": "123",
          "labelPolicies": [
            {
              "selector": "{env != \"dev\"}"
            }
          ]
        }
      ],
      "conditions": {
        "allowedSubnets": ["192.168.0.0/24", "10.1.2.99/32"]
      },
      "createdAt": "2022-06-08T16:47:46.151Z",
      "updatedAt": "2022-06-08T16:47:46.151Z",
      "status": "active"
    }
  ],
  "metadata": {
    "pagination": {
      "pageSize": 500,
      "pageCursor": "ZDMyYzZhODktZjU1ZC00NGViLWJmYWEtMTEyYmE2NTFlNDJifDIwMjItMDQtMTFUMTI6NTQ6MDBa",
      "nextPage": "/v1/accesspolicies?pageCursor=ZDMyYzZhODktZjU1ZC00NGViLWJmYWEtMTEyYmE2NTFlNDJifDIwMjItMDQtMTFUMTI6NTQ6MDBa"
    }
  }
}
```

| Code  | Description                      |
| ----- | -------------------------------- |
| `400` | Bad request                      |
| `401` | API token is missing or invalid. |

### List one access policy

List one access policy with the `GET` method.

```http
GET https://www.grafana.com/api/v1/accesspolicies/{accessPolicyID}
```

#### Parameters

| Name             | Type   | Description                                                                                                                                                                                        | Required |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`         | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `accessPolicyId` | String | UUID. Path. ID of the access policy.                                                                                                                                                               | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "orgId": "1",
  "name": "stack-readers",
  "displayName": "Stack Readers",
  "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
  "realms": [
    {
      "type": "stack",
      "identifier": "123",
      "labelPolicies": [
        {
          "selector": "{env != \"dev\"}"
        }
      ]
    }
  ],
  "conditions": {
    "allowedSubnets": ["192.168.0.0/24", "10.1.2.99/32"]
  },
  "createdAt": "2022-06-08T21:06:27.853Z",
  "updatedAt": "2022-06-08T21:06:27.853Z",
  "status": "active"
}
```

| Code  | Description                      |
| ----- | -------------------------------- |
| `400` | Bad request                      |
| `401` | API token is missing or invalid. |

### Update an access policy

Update an existing access policy with the `POST` method.

{{< admonition type="note" >}}
To remove [IP ranges](/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/ip-ranges-access-policies/) do one of the following:

- set `allowedSubnets` to an empty array (`[]`)
- set `conditions` to `null` or to an empty object (`{}`).

{{< /admonition >}}

```http
POST https://www.grafana.com/api/v1/accesspolicies/{accessPolicyId}
```

#### Parameters

| Name             | Type   | Description                                                                                                                                                                                        | Required |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`         | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `accessPolicyId` | String | (`UUID`). Path. ID of the access policy.                                                                                                                                                           | Yes      |

#### Request body

The request body specifies the revised access policy.

| Name          | Type         | Description                                                                                                                                                        | Required |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --- | --- |
| `displayName` | String       | Display name of the access policy, visible in the UI. It must be 1-255 characters long.                                                                            | No       |     | No  |
| `scopes`      | List[String] | List of [**scopes**](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#scopes).                            | Yes      |
| `realms`      | List[Realm]  | List of [**realms**](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#realms).                            | Yes      |
| `conditions`  | Conditions   | A set of criteria that is used to restrict access of the access policy and tokens. Providing an empty object `{}` results in the complete removal of `conditions`. | No       |
| `status`      | String       | The status of the access policy. Must be `active` or `inactive`.                                                                                                   | No       |

**Realm**

| Name            | Type              | Description                                                                                                                                                                                                                    | Required |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `type`          | String            | Type of realm. Can be `org` or `stack`.                                                                                                                                                                                        | Yes      |
| `identifier`    | String            | The unique identifier of a realm (ID of the org or stack depending on the realm type).                                                                                                                                         | Yes      |
| `labelPolicies` | List[LabelPolicy] | List of [label policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#labelpolicy-or-label-selectors). Available only with read permissions for metrics and logs. | No       |

**LabelPolicy**

| Name       | Type   | Description                                                                                                                                                 | Required |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `selector` | String | [Label selector](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#labelpolicy-or-label-selectors). | Yes      |

**Conditions**

| Name             | Type         | Description                                                                                                                                                                                                                                                                 | Required |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `allowedSubnets` | List[String] | An array of IP addresses with subnet masks in CIDR notation (both IPv4 or IPv6 are supported) for [IP range based access control](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/#ip-range-based-access-control). | Yes      |

Example request:

```json
{
  "displayName": "Stack Readers",
  "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
  "realms": [
    {
      "type": "stack",
      "identifier": "123",
      "labelPolicies": [
        {
          "selector": "{env != \"dev\"}"
        }
      ]
    }
  ],
  "conditions": {
    "allowedSubnets": ["192.168.99.100/32"]
  },
  "status": "active"
}
```

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "orgId": "1",
  "name": "stack-readers",
  "displayName": "Stack Readers",
  "scopes": ["metrics:read", "logs:read", "traces:read", "alerts:read"],
  "realms": [
    {
      "type": "stack",
      "identifier": "123",
      "labelPolicies": [
        {
          "selector": "{env != \"dev\"}"
        }
      ]
    }
  ],
  "conditions": {
    "allowedSubnets": ["192.168.99.100/32"]
  },
  "createdAt": "2022-06-08T21:10:37.011Z",
  "updatedAt": "2022-06-08T21:10:37.011Z",
  "status": "active"
}
```

| Code  | Description                      |
| ----- | -------------------------------- |
| `400` | Bad request                      |
| `401` | API token is missing or invalid. |

### Delete an access policy

Remove an access policy with the `DELETE` method.

```http
DELETE https://www.grafana.com/api/v1/accesspolicies/{accessPolicyId}
```

#### Parameters

| Name             | Type   | Description                                                                                                                                                                                        | Required |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`         | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `accessPolicyId` | String | (`UUID`). Path. ID of the access policy.                                                                                                                                                           | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description                         |
| ----- | ----------------------------------- |
| `204` | Access policy deleted successfully. |
| `400` | Bad request                         |
| `401` | API token is missing or invalid     |

### Create a token

Create a token with the `POST` method.

```http
POST https://www.grafana.com/api/v1/tokens
```

#### Parameters

| Name     | Type   | Description                                                                                                                                                                                        | Required |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region` | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |

#### Request body

The request body contains details about the token being created.

| Name             | Type   | Description                                                                                                                                                                                  | Required |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `name`           | String | Name of the access policy. It must be 1-255 characters long. Characters can only include lowercase letters from the English alphabet (a-z), numbers (0-9), hyphens (-) and underscores (\_). | Yes      |
| `displayName`    | String | Display name of the token, visible in the UI. Set to `name` if not provided. It must be 1-255 characters long.                                                                               | No       |
| `accessPolicyId` | String | ID of the access policy to create the token for.                                                                                                                                             | Yes      |
| `expiresAt`      | String | Token expiration date. The token does not expire if this is not provided.                                                                                                                    | No       |

Example request:

```json
{
  "accessPolicyId": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "name": "mytoken",
  "displayName": "My Token",
  "expiresAt": "2022-06-08T22:05:46.958Z"
}
```

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "accessPolicyId": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "name": "mytoken",
  "displayName": "My Token",
  "expiresAt": "2022-06-08T22:05:46.959Z",
  "firstUsedAt": "2022-06-08T22:05:46.959Z",
  "lastUsedAt": "2022-06-08T22:05:46.959Z",
  "createdAt": "2022-06-08T22:05:46.959Z",
  "updatedAt": "2022-06-08T22:05:46.959Z",
  "token": "glc_eyJrIjoiZjI0YzZkNGEwZDBmZmZjMmUzNTU2ODcxMmY0ZWZlNTQ1NTljMDFjOCIsIm4iOiJteXRva2VuIiwiaWQiOjF9"
}
```

| Code  | Description                     |
| ----- | ------------------------------- |
| `400` | Bad request                     |
| `401` | API token is missing or invalid |
| `409` | Conflict                        |

### List a set of tokens

List a set of tokens with the `GET` method.

```http
GET https://www.grafana.com/api/v1/tokens
```

#### Parameters

| Name                          | Type   | Description                                                                                                                                                                                        | Required |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `accessPolicyId `             | String | Query. ID of the access policy to filter by.                                                                                                                                                       | No       |
| `accessPolicyName`            | String | Query. Name of the access policy to filter by.                                                                                                                                                     | No       |
| `accessPolicyRealmType`       | String | Query. Type of the access policy realm. Available values are `org` and `stack`.                                                                                                                    | No       |
| `accessPolicyRealmIdentifier` | String | Query. Identifier of the access policy realm. Requires `accessPolicyRealmType.`                                                                                                                    | No       |
| `name`                        | String | Query. Name of the Token to filter by.                                                                                                                                                             | No       |
| `expiresBefore`               | String | Query. Time (in ISO8601 UTC format) to filter tokens that have `expiresAt` set before the given time.                                                                                              | No       |
| `expiresAfter`                | String | Query. Time (in ISO8601 UTC format) to filter tokens that have `expiresAt` set after the given time.                                                                                               | No       |
| `pageSize`                    | String | Query. The number of records to be returned per page. Default value is `500`; the maximum value is `500`.                                                                                          | No       |
| `pageCursor`                  | String | Query. A cursor used for paging through the results. If you omit the `pageCursor` parameter, or provide an empty `pageCursor` value, you receive the first page.                                   | No       |
| `region`                      | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `accessPolicyStatus`          | String | Query. A filter to only list tokens which Access Policies are in the given status. Available values are `active` and `inactive`.                                                                   | No       |

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "items": [
    {
      "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
      "accessPolicyId": "c45485b6-8321-4cf2-bcec-12006df755ff",
      "name": "mytoken",
      "displayName": "My Token",
      "expiresAt": "2022-06-08T22:11:05.614Z",
      "firstUsedAt": "2022-06-08T22:11:05.614Z",
      "lastUsedAt": "2022-06-08T22:11:05.614Z",
      "createdAt": "2022-06-08T22:11:05.614Z",
      "updatedAt": "2022-06-08T22:11:05.614Z"
    }
  ],
  "metadata": {
    "pagination": {
      "pageSize": 500,
      "pageCursor": "ZDMyYzZhODktZjU1ZC00NGViLWJmYWEtMTEyYmE2NTFlNDJifDIwMjItMDQtMTFUMTI6NTQ6MDBa",
      "nextPage": "/v1/accesspolicies?pageCursor=ZDMyYzZhODktZjU1ZC00NGViLWJmYWEtMTEyYmE2NTFlNDJifDIwMjItMDQtMTFUMTI6NTQ6MDBa"
    }
  }
}
```

| Code  | Description                     |
| ----- | ------------------------------- |
| `400` | Bad request                     |
| `401` | API token is missing or invalid |

### List a single token

List a specified token with the `GET` method.

```http
GET https://www.grafana.com/api/v1/tokens/{tokenId}
```

#### Parameters

| Name      | Type   | Description                                                                                                                                                                                        | Required |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`  | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `tokenId` | String | (`UUID`). Path. ID of the Token.                                                                                                                                                                   | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "accessPolicyId": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "name": "mytoken",
  "displayName": "My Token",
  "expiresAt": "2022-06-09T04:31:23.559Z",
  "firstUsedAt": "2022-06-09T04:31:23.559Z",
  "lastUsedAt": "2022-06-09T04:31:23.559Z",
  "createdAt": "2022-06-09T04:31:23.559Z",
  "updatedAt": "2022-06-09T04:31:23.559Z"
}
```

| Code  | Description                     |
| ----- | ------------------------------- |
| `400` | Bad request                     |
| `401` | API token is missing or invalid |

### Update a token

Update a specified token with the `POST` method.

```http
POST https://www.grafana.com/api/v1/tokens/{tokenId}
```

#### Parameters

| Name      | Type   | Description                                                                                                                                                                                        | Required |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`  | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `tokenId` | String | (`UUID`). Path. ID of the Token.                                                                                                                                                                   | Yes      |

#### Request body

The request body contains the updated values being applied to the token.

| Name          | Type   | Description                                                                                              | Required |
| ------------- | ------ | -------------------------------------------------------------------------------------------------------- | -------- |
| `displayName` | String | Display name of the token, visible in the UI. It must be 1-255 characters long.                          | No       |
| `expiresAt`   | String | Token expiration date (in ISO8601 UTC format). The token does not expire if this field is set to `null`. | No       |

Example request:

```json
{
  "displayName": "My token",
  "expiresAt": "2022-06-09T04:43:16.296Z"
}
```

#### Responses

The following responses may be returned.

| Code  | Description          |
| ----- | -------------------- |
| `200` | Successful operation |

Example response:

```json
{
  "id": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "accessPolicyId": "c45485b6-8321-4cf2-bcec-12006df755ff",
  "name": "mytoken",
  "displayName": "My token",
  "expiresAt": "2022-06-09T04:43:16.296Z",
  "firstUsedAt": "2022-06-09T04:43:16.296Z",
  "lastUsedAt": "2022-06-09T04:43:16.296Z",
  "createdAt": "2022-06-09T04:43:16.296Z",
  "updatedAt": "2022-06-09T04:43:16.296Z"
}
```

| Code  | Description                     |
| ----- | ------------------------------- |
| `400` | Bad request                     |
| `401` | API token is missing or invalid |
| `409` | Conflict.                       |

### Delete a token

Remove a specified token with the `DELETE` method.

```http
DELETE https://www.grafana.com/api/v1/tokens/{tokenId}
```

#### Parameters

| Name      | Type   | Description                                                                                                                                                                                        | Required |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `region`  | String | Query. Region of the Access Policy, as defined in the Access Policy. Some example values are `us`, `eu`, `au`, and `prod-eu-west-3`. For more information, refer to [List regions](#list-regions). | Yes      |
| `tokenId` | String | (`UUID`). Path. ID of the Token.                                                                                                                                                                   | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description                     |
| ----- | ------------------------------- |
| `204` | Token deleted successfully      |
| `400` | Bad request                     |
| `401` | API token is missing or invalid |

## Stacks

{{< admonition type="note" >}}
Grafana Cloud Free includes 1 stack and Grafana Cloud Pro includes up to 3 stacks.
[Reach out to support](/contact/) about a Grafana Cloud contracted plan if you would like to add additional stacks to your account.
{{< /admonition >}}

### List stacks

```http
GET https://grafana.com/api/orgs/<ORG_SLUG>/instances
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |

Example response:

```json
{
  "items": [
    {
      "id": 007303,
      "orgId": 052992,
      "orgSlug": "grafanacom",
      "orgName": "grafanacom",
      "type": "grafana",
      "name": "cloudapistack.grafana.net",
      "url": "https://cloudapistack.grafana.net",
      "slug": "cloudapistack",
      "version": "stable",
      "description": "",
      "status": "active",
      "gateway": "istio",
      "createdAt": "2023-01-04T06:43:24.000Z",
      "createdBy": "foobar",
      "updatedAt": null,
      "updatedBy": "",
      "trial": 0,
      "trialExpiresAt": null,
      "clusterId": 69,
      "clusterSlug": "prod-us-central-0",
      "clusterName": "prod-us-central-0",
      "plan": "gcloud",
      "planName": "Grafana Cloud",
      "billingStartDate": "2023-01-04T06:43:23.000Z",
      "billingEndDate": null,
      "billingActiveUsers": 0,
      "billingGrafanaActiveUsers": 0,
      "billingOnCallActiveUsers": 0,
      "currentActiveUsers": 0,
      "currentActiveAdminUsers": 0,
      "currentActiveEditorUsers": 0,
      "currentActiveViewerUsers": 0,
      "dailyUserCnt": 0,
      "dailyAdminCnt": 0,
      "dailyEditorCnt": 0,
      "dailyViewerCnt": 0,
      "dashboardCnt": 8,
      "datasourceCnts": {},
      "userQuota": 10,
      "dashboardQuota": -1,
      "alertQuota": -1,
      "alertCnt": 0,
      "ssl": true,
      "customAuth": true,
      "customDomain": true,
      "support": true,
      "runningVersion": "9.3.2-45365 (commit: ef5286dd77, branch: v9.3.x)",
      "machineLearning": 0,
      "incident": 0,
      "hmInstancePromId": 715391,
      "hmInstancePromUrl": "https://prometheus-us-central1.grafana.net",
      "hmInstancePromName": "cloudapistack-prom",
      "hmInstancePromStatus": "active",
      "hmInstancePromCurrentUsage": 0,
      "hmInstancePromCurrentActiveSeries": 0,
      "hmInstanceGraphiteId": 715392,
      "hmInstanceGraphiteUrl": "https://graphite-prod-10-prod-us-central-0.grafana.net",
      "hmInstanceGraphiteName": "cloudapistack-graphite",
      "hmInstanceGraphiteType": "graphite-v5",
      "hmInstanceGraphiteStatus": "active",
      "hmInstanceGraphiteCurrentUsage": 0,
      "hlInstanceId": 356665,
      "hlInstanceUrl": "https://logs-prod-017.grafana.net",
      "hlInstanceName": "cloudapistack-logs",
      "hlInstanceStatus": "active",
      "hlInstanceCurrentUsage": 0,
      "amInstanceId": 355647,
      "amInstanceName": "cloudapistack-alerts",
      "amInstanceUrl": "https://alertmanager-us-central1.grafana.net",
      "amInstanceStatus": "active",
      "amInstanceGeneratorUrl": "https://cloudapistack.grafana.net",
      "amInstanceGeneratorUrlDatasource": "",
      "htInstanceId": 353178,
      "htInstanceUrl": "https://tempo-us-central1.grafana.net",
      "htInstanceName": "cloudapistack-traces",
      "htInstanceStatus": "active",
      "regionId": 1,
      "regionSlug": "us",
      "links": [
        {
          "rel": "self",
          "href": "/instances/cloudapistack"
        },
        {
          "rel": "org",
          "href": "/orgs/grafanacom"
        },
        {
          "rel": "plugins",
          "href": "/instances/cloudapistack/plugins"
        }
      ]
    }
  ],
  "orderBy": "name",
  "direction": "asc",
  "total": 1,
  "pages": 1,
  "pageSize": 1000000,
  "page": 1,
  "links": [
    {
      "rel": "self",
      "href": "/instances"
    }
  ]
}
```

### Get a stack's connectivity info

```http
GET https://grafana.com/api/instances/<STACK_SLUG>/connections
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |

Example response:

```json
{
  "privateConnectivityInfo": {
    "tenants": [
      {
        "type": "prometheus",
        "id": 1899232,
        "info": {
          "privateDNS": "cortex-prod-13-cortex-gw.us-east-2.vpce.grafana.net",
          "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-0d13a270cd91a0a3a"
        },
        "ipAllowListCNAME": "src-ips.prometheus-prod-13-prod-us-east-0.grafana.net"
      },
      {
        "type": "graphite",
        "id": 1899233,
        "info": {
          "privateDNS": "cortex-prod-13-cortex-gw.us-east-2.vpce.grafana.net",
          "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-0d13a270cd91a0a3a"
        },
        "ipAllowListCNAME": "src-ips.prometheus-prod-13-prod-us-east-0.grafana.net"
      },
      {
        "type": "logs",
        "id": 1048899,
        "info": {
          "privateDNS": "loki-prod-006-cortex-gw.us-east-2.vpce.grafana.net",
          "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-071e7d98821c1698b"
        },
        "ipAllowListCNAME": "src-ips.logs-prod-006.grafana.net"
      },
      {
        "type": "traces",
        "id": 1043214,
        "info": {
          "privateDNS": "tempo-prod-04-cortex-gw.us-east-2.vpce.grafana.net",
          "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-0a830aaea99ecfc91"
        },
        "ipAllowListCNAME": "src-ips.tempo-prod-04-prod-us-east-0.grafana.net"
      },
      {
        "type": "profiles",
        "id": 1091120,
        "info": {
          "privateDNS": "profiles-prod-001-cortex-gw.us-east-2.vpce.grafana.net",
          "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-079d447d0143b24e7"
        },
        "ipAllowListCNAME": "src-ips.profiles-prod-001.grafana.net"
      },
      {
        "type": "alerts",
        "id": 947554,
        "ipAllowListCNAME": "src-ips.alertmanager-prod-us-east-0.grafana.net"
      },
      {
        "type": "grafana",
        "id": 1091120,
        "ipAllowListCNAME": null
      }
    ],
    "otlp": {
      "privateDNS": "prod-us-east-0-otlp-gateway.us-east-2.vpce.grafana.net",
      "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-0d36af67949f874c4"
    },
    "pdc": {
      "api": {
        "privateDNS": "private-datasource-connect-api.us-east-2.vpce.grafana.net",
        "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-0078cfdaab047fc37"
      },
      "gateway": {
        "privateDNS": "private-datasource-connect.us-east-2.vpce.grafana.net",
        "serviceName": "com.amazonaws.vpce.us-east-2.vpce-svc-032570426402bc97e"
      }
    }
  },
  "influxUrl": "https://influx-prod-13-prod-us-east-0.grafana.net",
  "otlpHttpUrl": "https://otlp-gateway-prod-us-east-0.grafana.net",
  "oncallApiUrl": "https://oncall-prod-us-east-0.grafana.net/oncall",
  "appPlatform": {
    "url": "https://app-platform-apiserver-prod-us-east-0.grafana.net",
    "caData": "<SOME-VERY-LONG-PUBLIC-KEY>"
  }
}
```

That endpoint contains the way to connect to the various tenants the stack has,
including [AWS PrivateLink](/docs/grafana-cloud/send-data/aws-privatelink/) if the region is AWS.

### Create stack

{{< admonition type="note" >}}
This `POST` request accepts lowercase characters only.
{{< /admonition >}}

```http
POST https://grafana.com/api/instances
```

#### Request Body

| Name               | Type              | Description                                                                                                                                                                                                                                                                                                                                        | Required |
| ------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `name`             | String            | Name of stack. Conventionally matches the URL of the instance. For example, `<STACK_SLUG>.grafana.net`.                                                                                                                                                                                                                                            | Yes      |
| `slug`             | String            | Subdomain that the Grafana instance to make the instance available at. For example, if you set the slug to `<STACK_SLUG>`, the full URL for the instance is `https://<STACK_SLUG>.grafana.net`.                                                                                                                                                    | Yes      |
| `url`              | String            | If you use a custom domain for the instance, you must provide it here. For example, `"https://grafana.yourdoman.io"`.                                                                                                                                                                                                                              | No       |
| `region`           | String            | Choose a region for your stack. For example, you can specify the United States (`us`) or Europe (`eu`). Use the `GET /api/stack-regions` endpoint to see a list of regions to choose from. For more information, refer to [List regions](#list-regions). If you don't specify a region, the default is `us`.                                       | No       |
| `description`      | String            | A short text that describes the purpose of the stack.                                                                                                                                                                                                                                                                                              | No       |
| `labels`           | map[String]String | Add labels to a stack if you want to add a visual way to distinguish them [in the UI](/docs/grafana-cloud/account-management/cloud-portal/#create-stack-labels). Labels are `key:value` pairs where the both the key and value can alphanumeric, `.`, `-` or `/`. Up to 10 labels are allowed. Example: `{"team":"platform", "environment":"dev"}` | No       |
| `deleteProtection` | Boolean           | Prevents the stack from being accidentally deleted. When set to true, delete operations on the stack are blocked until this protection is disabled. Recommended for production or critical environments.                                                                                                                                           | No       |

{{< admonition type="note" >}}
For the custom domain, you must set up a `CNAME` record that points to `<STACK_SLUG>.grafana.net` before you can specify the domain.
{{< /admonition >}}

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |
| `409` | Conflict.                        |

Example response:

```json
{
  "id": 507363,
  "orgId": 652992,
  "orgSlug": "grafanacom",
  "orgName": "grafanacom",
  "type": "grafana",
  "name": "createcloudstack",
  "url": "https://createcloudstack.grafana.net",
  "slug": "createcloudstack",
  "version": "stable",
  "labels": {
    "key": "value"
  },
  "description": "",
  "status": "active",
  "gateway": "istio",
  "createdAt": "2023-01-04T08:20:07.000Z",
  "createdBy": "testengineer",
  "updatedAt": null,
  "updatedBy": "",
  "trial": 0,
  "trialExpiresAt": null,
  "clusterId": 69,
  "clusterSlug": "prod-us-central-0",
  "clusterName": "prod-us-central-0",
  "plan": "gcloud",
  "planName": "Grafana Cloud",
  "billingStartDate": "2023-01-04T08:20:06.000Z",
  "billingEndDate": null,
  "billingActiveUsers": 0,
  "billingGrafanaActiveUsers": 0,
  "billingOnCallActiveUsers": 0,
  "currentActiveUsers": 0,
  "currentActiveAdminUsers": 0,
  "currentActiveEditorUsers": 0,
  "currentActiveViewerUsers": 0,
  "dailyUserCnt": 0,
  "dailyAdminCnt": 0,
  "dailyEditorCnt": 0,
  "dailyViewerCnt": 0,
  "dashboardCnt": 0,
  "datasourceCnts": {},
  "userQuota": 10,
  "dashboardQuota": -1,
  "alertQuota": -1,
  "alertCnt": 0,
  "ssl": true,
  "customAuth": true,
  "customDomain": true,
  "support": true,
  "runningVersion": "",
  "machineLearning": 0,
  "incident": 0,
  "deleteProtection": true,
  "hmInstancePromId": 715511,
  "hmInstancePromUrl": "https://prometheus-us-central1.grafana.net",
  "hmInstancePromName": "createcloudstack-prom",
  "hmInstancePromStatus": "active",
  "hmInstancePromCurrentUsage": 0,
  "hmInstancePromCurrentActiveSeries": 0,
  "hmInstanceGraphiteId": 715512,
  "hmInstanceGraphiteUrl": "https://graphite-prod-10-prod-us-central-0.grafana.net",
  "hmInstanceGraphiteName": "createcloudstack-graphite",
  "hmInstanceGraphiteType": "graphite-v5",
  "hmInstanceGraphiteStatus": "active",
  "hmInstanceGraphiteCurrentUsage": 0,
  "hlInstanceId": 356725,
  "hlInstanceUrl": "https://logs-prod-017.grafana.net",
  "hlInstanceName": "createcloudstack-logs",
  "hlInstanceStatus": "active",
  "hlInstanceCurrentUsage": 0,
  "amInstanceId": 355707,
  "amInstanceName": "createcloudstack-alerts",
  "amInstanceUrl": "https://alertmanager-us-central1.grafana.net",
  "amInstanceStatus": "active",
  "amInstanceGeneratorUrl": "https://createcloudstack.grafana.net",
  "amInstanceGeneratorUrlDatasource": "",
  "htInstanceId": 353238,
  "htInstanceUrl": "https://tempo-us-central1.grafana.net",
  "htInstanceName": "createcloudstack-traces",
  "htInstanceStatus": "active",
  "regionId": 1,
  "regionSlug": "us",
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack"
    },
    {
      "rel": "org",
      "href": "/orgs/grafanacom"
    },
    {
      "rel": "plugins",
      "href": "/instances/createcloudstack/plugins"
    }
  ]
}
```

### Update stack

{{< admonition type="note" >}}
This `POST` request accepts lowercase characters only.
{{< /admonition >}}

```http
POST https://grafana.com/api/instances/<STACK_SLUG>
```

#### Request Body

| Name               | Type              | Description                                                                                                                                                                                                                                                                                               | Required |
| ------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `description`      | String            | A short text that describes the purpose of the stack.                                                                                                                                                                                                                                                     | No       |
| `labels`           | map[String]String | Updates labels for a stack. Labels are `key:value` pairs where the both the key and value can alphanumeric, `.`, `-` or `/`. Up to 10 labels are allowed. To remove a label, just omit it in this request. To remove all labels send an empty object. Example: `{"team":"platform", "environment":"dev"}` | No       |
| `name`             | String            | Name of stack. Conventionally matches the URL of the instance. For example, `<STACK_SLUG>.grafana.net`.                                                                                                                                                                                                   | No       |
| `deleteProtection` | Boolean           | Enables or disables delete protection for the stack. When set to true, it prevents the stack from being accidentally deleted. To allow deletion, set this to false.                                                                                                                                       | No       |

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |
| `409` | Conflict.                        |

Example response:

```json
{
  "id": 507363,
  "orgId": 652992,
  "orgSlug": "grafanacom",
  "orgName": "grafanacom",
  "type": "grafana",
  "name": "createcloudstack",
  "url": "https://createcloudstack.grafana.net",
  "slug": "createcloudstack",
  "labels": {
    "newkey": "newvalue"
  },
  "version": "stable",
  "description": "",
  "status": "active",
  "gateway": "istio",
  "createdAt": "2023-01-04T08:20:07.000Z",
  "createdBy": "testengineer",
  "updatedAt": null,
  "updatedBy": "",
  "trial": 0,
  "trialExpiresAt": null,
  "clusterId": 69,
  "clusterSlug": "prod-us-central-0",
  "clusterName": "prod-us-central-0",
  "plan": "gcloud",
  "planName": "Grafana Cloud",
  "billingStartDate": "2023-01-04T08:20:06.000Z",
  "billingEndDate": null,
  "billingActiveUsers": 0,
  "billingGrafanaActiveUsers": 0,
  "billingOnCallActiveUsers": 0,
  "currentActiveUsers": 0,
  "currentActiveAdminUsers": 0,
  "currentActiveEditorUsers": 0,
  "currentActiveViewerUsers": 0,
  "dailyUserCnt": 0,
  "dailyAdminCnt": 0,
  "dailyEditorCnt": 0,
  "dailyViewerCnt": 0,
  "dashboardCnt": 0,
  "datasourceCnts": {},
  "userQuota": 10,
  "dashboardQuota": -1,
  "alertQuota": -1,
  "alertCnt": 0,
  "ssl": true,
  "customAuth": true,
  "customDomain": true,
  "support": true,
  "runningVersion": "",
  "machineLearning": 0,
  "incident": 0,
  "deleteProtection": true,
  "hmInstancePromId": 715511,
  "hmInstancePromUrl": "https://prometheus-us-central1.grafana.net",
  "hmInstancePromName": "createcloudstack-prom",
  "hmInstancePromStatus": "active",
  "hmInstancePromCurrentUsage": 0,
  "hmInstancePromCurrentActiveSeries": 0,
  "hmInstanceGraphiteId": 715512,
  "hmInstanceGraphiteUrl": "https://graphite-prod-10-prod-us-central-0.grafana.net",
  "hmInstanceGraphiteName": "createcloudstack-graphite",
  "hmInstanceGraphiteType": "graphite-v5",
  "hmInstanceGraphiteStatus": "active",
  "hmInstanceGraphiteCurrentUsage": 0,
  "hlInstanceId": 356725,
  "hlInstanceUrl": "https://logs-prod-017.grafana.net",
  "hlInstanceName": "createcloudstack-logs",
  "hlInstanceStatus": "active",
  "hlInstanceCurrentUsage": 0,
  "amInstanceId": 355707,
  "amInstanceName": "createcloudstack-alerts",
  "amInstanceUrl": "https://alertmanager-us-central1.grafana.net",
  "amInstanceStatus": "active",
  "amInstanceGeneratorUrl": "https://createcloudstack.grafana.net",
  "amInstanceGeneratorUrlDatasource": "",
  "htInstanceId": 353238,
  "htInstanceUrl": "https://tempo-us-central1.grafana.net",
  "htInstanceName": "createcloudstack-traces",
  "htInstanceStatus": "active",
  "regionId": 1,
  "regionSlug": "us",
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack"
    },
    {
      "rel": "org",
      "href": "/orgs/grafanacom"
    },
    {
      "rel": "plugins",
      "href": "/instances/createcloudstack/plugins"
    }
  ]
}
```

### Delete stack

```http
DELETE https://grafana.com/api/instances/<STACK_SLUG>
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `404` | Cloud Stack not found.           |
| `409` | Delete protection is enabled.    |

{{< admonition type="caution" >}}
If you receive a `409` response code, it means the stack has delete protection enabled. You must first disable the `deleteProtection` flag for the stack before you can successfully delete it.
{{< /admonition >}}

Example response:

```json
{
  "id": 507366,
  "orgId": 652992,
  "orgSlug": "grafanacom",
  "orgName": "grafanacom",
  "type": "grafana",
  "name": "createcloudstack",
  "url": "https://createcloudstack.grafana.net",
  "slug": "createcloudstack",
  "version": "stable",
  "description": "",
  "status": "deleted",
  "gateway": "istio",
  "createdAt": "2023-01-04T08:22:00.000Z",
  "createdBy": "ishanjain",
  "updatedAt": "2023-01-04T08:30:36.066Z",
  "updatedBy": "ishanjain",
  "trial": 0,
  "trialExpiresAt": null,
  "clusterId": 69,
  "clusterSlug": "prod-us-central-0",
  "clusterName": "prod-us-central-0",
  "plan": "gcloud",
  "planName": "Grafana Cloud",
  "billingStartDate": "2023-01-04T08:21:59.000Z",
  "billingEndDate": "2023-01-04T08:30:36.066Z",
  "billingActiveUsers": 0,
  "billingGrafanaActiveUsers": 0,
  "billingOnCallActiveUsers": 0,
  "currentActiveUsers": 0,
  "currentActiveAdminUsers": 0,
  "currentActiveEditorUsers": 0,
  "currentActiveViewerUsers": 0,
  "dailyUserCnt": 0,
  "dailyAdminCnt": 0,
  "dailyEditorCnt": 0,
  "dailyViewerCnt": 0,
  "dashboardCnt": 0,
  "datasourceCnts": {},
  "userQuota": 10,
  "dashboardQuota": -1,
  "alertQuota": -1,
  "alertCnt": 0,
  "ssl": true,
  "customAuth": true,
  "customDomain": true,
  "support": true,
  "runningVersion": "9.3.2-45365 (commit: ef5286dd77, branch: v9.3.x)",
  "machineLearning": 0,
  "incident": 0,
  "deleteProtection": false,
  "hmInstancePromId": 715517,
  "hmInstancePromUrl": "https://prometheus-us-central1.grafana.net",
  "hmInstancePromName": "createcloudstack-prom",
  "hmInstancePromStatus": "active",
  "hmInstancePromCurrentUsage": 0,
  "hmInstancePromCurrentActiveSeries": 0,
  "hmInstanceGraphiteId": 715518,
  "hmInstanceGraphiteUrl": "https://graphite-prod-10-prod-us-central-0.grafana.net",
  "hmInstanceGraphiteName": "createcloudstack-graphite",
  "hmInstanceGraphiteType": "graphite-v5",
  "hmInstanceGraphiteStatus": "active",
  "hmInstanceGraphiteCurrentUsage": 0,
  "hlInstanceId": 356728,
  "hlInstanceUrl": "https://logs-prod-017.grafana.net",
  "hlInstanceName": "createcloudstack-logs",
  "hlInstanceStatus": "active",
  "hlInstanceCurrentUsage": 0,
  "amInstanceId": 355710,
  "amInstanceName": "createcloudstack1-alerts",
  "amInstanceUrl": "https://alertmanager-us-central1.grafana.net",
  "amInstanceStatus": "active",
  "amInstanceGeneratorUrl": "https://createcloudstack.grafana.net",
  "amInstanceGeneratorUrlDatasource": "",
  "htInstanceId": 353241,
  "htInstanceUrl": "https://tempo-us-central1.grafana.net",
  "htInstanceName": "createcloudstack-traces",
  "htInstanceStatus": "active",
  "regionId": 1,
  "regionSlug": "us",
  "links": [
    {
      "rel": "self",
      "href": "/instances/507366"
    },
    {
      "rel": "org",
      "href": "/orgs/grafanacom"
    },
    {
      "rel": "plugins",
      "href": "/instances/507366/plugins"
    }
  ]
}
```

### Restart Grafana

```http
POST https://grafana.com/api/instances/<STACK_SLUG>/restart
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation             |
| `401` | API token is missing or invalid. |
| `404` | Cloud Stack not found            |

Example response:

```json
true
```

### Create Hosted Grafana instance API keys

```http
POST https://grafana.com/api/instances/<STACK_SLUG>/api/auth/keys
```

This creates API keys specific to use for managing your hosted Grafana instance.
This is different from [Grafana Cloud API keys](#api-keys) created for Grafana Cloud operations.

This endpoint requires the Admin role.

#### Request Body

| Name            | Type   | Description                                                                                                                                                                                                                           | Required |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `name`          | String | Name of the API key.                                                                                                                                                                                                                  | Yes      |
| `role`          | String | Access level/Grafana role for the key. Can be one of the following values: `Viewer`, `Editor`, or `Admin`.                                                                                                                            | Yes      |
| `secondsToLive` | Number | Key expiration in seconds. If it's a positive number, an expiration date for the key is set. The key doesn't expire if it's `null`, `0`, or is omitted completely (unless `api_key_max_seconds_to_live` configuration option is set). | No       |

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `404` | Cloud Stack not found.           |
| `409` | Conflict.                        |

Example response:

```json
{
  "id": 1,
  "name": "testkey",
  "key": "eyJrIjoiMWpSRVhRUVJHZlc3NW1laklzV3htQUt0cUxtS3RuWFUiLCJuIjoidGVzdGtleSIsImlkIjoxf"
}
```

### List data sources

```http
GET https://grafana.com/api/instances/<STACK_SLUG>/datasources
```

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Cloud Stack not found.                                           |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "items": [
    {
      "id": 25744816,
      "instanceId": 2860016,
      "name": "grafanacloud-usage",
      "type": "prometheus",
      "access": "proxy",
      "grafanaOrgId": 1,
      "url": "https://billing.grafana.net/api/prom",
      "password": "",
      "user": "",
      "database": "",
      "basicAuth": 1,
      "basicAuthUser": "65299211",
      "withCredentials": 0,
      "isDefault": 0,
      "jsonData": {
        "timeInterval": "60s",
        "timeout": "150",
        "prometheusVersion": "2.3.0",
        "prometheusType": "Mimir"
      },
      "version": 1,
      "editable": 1,
      "delete": 0,
      "createdAt": "2023-01-04T08:20:13.484927Z",
      "updatedAt": null
    },
    {
      "id": 25744915,
      "instanceId": 2860016,
      "name": "grafanacloud-createcloudstack-logs",
      "type": "loki",
      "access": "proxy",
      "grafanaOrgId": 1,
      "url": "https://logs-prod-017.grafana.net",
      "password": "",
      "user": "",
      "database": "",
      "basicAuth": 1,
      "basicAuthUser": "3567215",
      "withCredentials": 0,
      "isDefault": 0,
      "jsonData": {
        "timeout": "300"
      },
      "version": 1,
      "editable": 1,
      "delete": 0,
      "createdAt": "2023-01-04T08:20:13.625323Z",
      "updatedAt": null
    }
  ]
}
```

## Grafana plugins

The API allows managing plugins installed on your hosted Grafana instances.

You can discover plugins in the [Grafana Plugins Directory](/grafana/plugins/).

### List plugins installed on an instance

```http
GET https://grafana.com/api/instances/<STACK_SLUG>/plugins
```

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Cloud Stack not found.                                           |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "items": [
    {
      "id": 256529,
      "instanceId": 507363,
      "instanceUrl": "https://createcloudstack.grafana.net",
      "pluginId": 663,
      "pluginSlug": "grafana-github-datasource",
      "pluginName": "GitHub",
      "version": "1.3.1",
      "latestVersion": "1.3.1",
      "createdAt": "2023-01-04T09:33:55.000Z",
      "updatedAt": null,
      "links": [
        {
          "rel": "self",
          "href": "/instances/507363/plugins/grafana-github-datasource"
        },
        {
          "rel": "instance",
          "href": "/instances/507363"
        }
      ]
    }
  ],
  "orderBy": "pluginName",
  "direction": "asc",
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack/plugins"
    }
  ]
}
```

### Add a plugin to instance

```http
POST https://grafana.com/api/instances/<STACK_SLUG>/plugins
```

#### Request Body

| Name      | Type   | Description                                                   | Required |
| --------- | ------ | ------------------------------------------------------------- | -------- |
| `plugin`  | String | Name of the plugin, for example, `grafana-github-datasource`. | Yes      |
| `version` | String | Version of the plugin to install. Defaults to `latest`.       | No       |

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Plugin or Cloud Stack not found.                                 |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "id": 256519,
  "instanceId": 507363,
  "instanceUrl": "https://createcloudstack.grafana.net",
  "instanceSlug": "createcloudstack",
  "pluginId": 663,
  "pluginSlug": "grafana-github-datasource",
  "pluginName": "GitHub",
  "version": "1.3.1",
  "latestVersion": "1.3.1",
  "createdAt": "2023-01-04T08:50:42.000Z",
  "updatedAt": null,
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack/plugins/grafana-github-datasource"
    },
    {
      "rel": "instance",
      "href": "/instances/createcloudstack"
    }
  ]
}
```

### Get installed plugin info

```http
GET https://grafana.com/api/instances/<STACK_SLUG>/plugins/<PLUGIN>
```

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Plugin or Cloud Stack not found.                                 |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "id": 256519,
  "instanceId": 507363,
  "instanceUrl": "https://createcloudstack.grafana.net",
  "instanceSlug": "createcloudstack",
  "pluginId": 663,
  "pluginSlug": "grafana-github-datasource",
  "pluginName": "GitHub",
  "version": "1.3.1",
  "latestVersion": "1.3.1",
  "createdAt": "2023-01-04T08:50:42.000Z",
  "updatedAt": null,
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack/plugins/grafana-github-datasource"
    },
    {
      "rel": "instance",
      "href": "/instances/createcloudstack"
    }
  ]
}
```

### Update installed plugin version

```http
POST https://grafana.com/api/instances/<STACK_SLUG>/plugins/<PLUGIN>
```

#### Request Body

| Name      | Type   | Description                    | Required |
| --------- | ------ | ------------------------------ | -------- |
| `version` | String | Updated version of the plugin. | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Plugin or Cloud Stack not found.                                 |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "id": 256519,
  "instanceId": 507363,
  "instanceUrl": "https://createcloudstack.grafana.net",
  "instanceSlug": "createcloudstack",
  "pluginId": 663,
  "pluginSlug": "grafana-github-datasource",
  "pluginName": "GitHub",
  "version": "1.3.0",
  "latestVersion": "1.3.1",
  "createdAt": "2023-01-04T08:50:42.000Z",
  "updatedAt": "2023-01-04T08:55:00.088Z",
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack/plugins/grafana-github-datasource"
    },
    {
      "rel": "instance",
      "href": "/instances/createcloudstack"
    }
  ]
}
```

### Delete an installed plugin

```http
DELETE https://grafana.com/api/instances/<STACK_SLUG>/plugins/<PLUGIN>
```

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `404` | Plugin or Cloud Stack not found.                                 |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "id": 256519,
  "instanceId": 507363,
  "instanceUrl": "https://createcloudstack.grafana.net",
  "instanceSlug": "createcloudstack",
  "pluginId": 663,
  "pluginSlug": "grafana-github-datasource",
  "pluginName": "GitHub",
  "version": "1.3.1",
  "latestVersion": "1.3.1",
  "createdAt": "2023-01-04T08:50:42.000Z",
  "updatedAt": "2023-01-04T08:59:20.794Z",
  "links": [
    {
      "rel": "self",
      "href": "/instances/createcloudstack/plugins/grafana-github-datasource"
    },
    {
      "rel": "instance",
      "href": "/instances/createcloudstack"
    }
  ]
}
```

## Regions

### List regions

Use the following call to retrieve a list of regions to specify when you create a stack.

```http
GET https://grafana.com/api/stack-regions
```

#### Responses

The following responses may be returned.

| Code  | Description                                                      |
| ----- | ---------------------------------------------------------------- |
| `200` | Successful operation.                                            |
| `401` | API token is missing or invalid.                                 |
| `409` | Conflicting operation, another operation is already in progress. |

Example response:

```json
{
  "items": [
    {
      "id": 1,
      "status": "active",
      "slug": "us",
      "name": "GCP US Central",
      "description": "United States",
      "provider": "gcp",
      "createdAt": "2021-08-20T20:00:27.000Z",
      "updatedAt": "2022-12-12T12:29:37.000Z"
    },
    {
      "id": 2,
      "status": "active",
      "slug": "us-azure",
      "name": "Azure US Central",
      "description": "United States (Azure)",
      "provider": "azure",
      "createdAt": "2021-08-20T20:08:03.000Z",
      "updatedAt": "2022-11-29T12:04:00.000Z"
    },
    {
      "id": 3,
      "status": "active",
      "slug": "eu",
      "name": "GCP Belgium",
      "description": "Europe",
      "provider": "gcp",
      "createdAt": "2021-08-20T20:28:52.000Z",
      "updatedAt": "2022-12-05T18:05:33.000Z"
    },
    {
      "id": 4,
      "status": "active",
      "slug": "au",
      "name": "GCP Australia",
      "description": "Australia",
      "provider": "gcp",
      "createdAt": "2021-11-16T22:03:18.000Z",
      "updatedAt": "2022-09-22T09:27:47.000Z"
    }
  ],
  "orderBy": "id",
  "direction": "asc",
  "total": 9,
  "pages": 1,
  "pageSize": 1000000,
  "page": 1,
  "links": [
    {
      "rel": "self",
      "href": "/stack-regions"
    }
  ]
}
```

## API keys

{{< admonition type="caution" >}}
Cloud API keys are now deprecated. Use [Cloud Access Policies](#access-policies-and-tokens) instead.
{{< /admonition >}}

### List API keys

```http
GET https://grafana.com/api/orgs/<ORG_SLUG>/api-keys
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |

Example response:

```json
{
  "items": [
    {
      "id": 5045812,
      "orgId": 652945,
      "orgSlug": "grafanacom",
      "orgName": "grafanacom",
      "instanceId": null,
      "name": "SRE",
      "role": "Admin",
      "createdAt": "2023-01-04T06:43:51.000Z",
      "updatedAt": null,
      "firstUsed": "2023-01-04T06:44:26.000Z",
      "links": [
        {
          "rel": "self",
          "href": "/orgs/grafanacom/api-keys/SRE"
        },
        {
          "rel": "org",
          "href": "/orgs/grafanacom"
        }
      ]
    }
  ],
  "orderBy": "name",
  "direction": "asc",
  "links": [
    {
      "rel": "self",
      "href": "/orgs/grafanacom/api-keys"
    }
  ]
}
```

### Create API key

```http
POST https://grafana.com/api/orgs/<ORG_SLUG>/api-keys
```

#### Request Body

| Name   | Type   | Description                                                                             | Required |
| ------ | ------ | --------------------------------------------------------------------------------------- | -------- |
| `name` | String | API key name                                                                            | Yes      |
| `role` | String | Permission level of API key. One of `Viewer`, `Editor`, `Admin`, or `MetricsPublisher`. | Yes      |

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `409` | Conflict.                        |

Example response:

```json
{
  "id": 5046212,
  "orgId": 652945,
  "orgSlug": "grafanacom",
  "orgName": "grafanacom",
  "instanceId": null,
  "name": "createapikey",
  "role": "Admin",
  "createdAt": "2023-01-04T07:50:54.000Z",
  "updatedAt": null,
  "firstUsed": null,
  "token": "eyJrIjoiZmU5ZDlmY2JkODkzNTg4ZGUyYTJhNmJiZGJiMWYwNjQyMGM0MzBkNiIsIm4iOiJjcmVhdGVhcGlrZXkiLCJpZCI6NjUyOTkyf",
  "links": [
    {
      "rel": "self",
      "href": "/orgs/grafanacom/api-keys/createapikey"
    },
    {
      "rel": "org",
      "href": "/orgs/grafanacom"
    }
  ]
}
```

### Delete API key

```http
DELETE https://grafana.com/api/orgs/<ORG_SLUG>/api-keys/<API KEY NAME>
```

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `404` | API Key not found.               |

Example response:

```json
true
```

## Billed usage

This API makes it possible to fetch billed usage broken down by stack for a specified year and month.

### Get billed usage

```http
GET https://grafana.com/api/orgs/<ORG_SLUG>/billed-usage?month=<MONTH>&year=<YEAR>
```

#### Parameters

| Name    | Type  | Description                                              | Required |
| ------- | ----- | -------------------------------------------------------- | -------- |
| `month` | Query | numeric value for the month to retrieve billed usage for | yes      |
| `year`  | Query | numeric value for the year to retrieve billed usage for  | yes      |

#### Responses

The following responses may be returned.

| Code  | Description                      |
| ----- | -------------------------------- |
| `200` | Successful operation.            |
| `401` | API token is missing or invalid. |
| `403` | Forbidden.                       |
| `404` | Not found.                       |
| `409` | Wrong or missing parameters.     |

Example response:

```json
{
  "items": [
    {
      "id": 1111198068,
      "dimensionId": "hl",
      "dimensionName": "Logs",
      "unit": "GB",
      "includedUsage": 50,
      "totalUsage": 251.02109133593612,
      "overage": 201,
      "orgRates": {
        "tiers": [
          {
            "min": 50,
            "rate": 0.5
          }
        ]
      },
      "amountDue": 100.5,
      "periodStart": "2024-09-01T00:00:00Z",
      "periodEnd": "2024-09-30T23:59:59Z",
      "description": "Hosted Logs Usage - September 2024",
      "notes": "Per-instance Usage\n - example-logs - Usage: 251.021GB\n\nIncluded Usage: 50GB\nTotal Usage: 251.021GB\nUsage in excess of 50GB: 201GB @ $0.5/GB = $100.50\nTotal Usage Amount: $100.50",
      "usages": [
        {
          "id": 1111163428,
          "stackId": 111118,
          "periodStart": "2024-09-01T00:00:00Z",
          "periodEnd": "2024-09-30T23:59:59Z",
          "totalUsage": 251.02109133593612,
          "isProrated": false,
          "ingestUsage": 251.02109133593612,
          "queryUsage": 1255.8636820528654,
          "stackName": "example.grafana.net",
          "stackLabels": {}
        }
      ]
    },
    {
      "id": 2222297587,
      "dimensionId": "hm",
      "dimensionName": "Metrics",
      "unit": "series",
      "includedUsage": 10000,
      "totalUsage": 129755.72,
      "overage": 119756,
      "orgRates": {
        "tiers": [
          {
            "min": 10000,
            "rate": 8
          }
        ],
        "includedDPM": 1
      },
      "amountDue": 958.05,
      "periodStart": "2024-09-01T00:00:00Z",
      "periodEnd": "2024-09-30T23:59:59Z",
      "description": "Hosted Metrics Usage - September 2024",
      "notes": "Per-instance Usage\n - example-prom - Series: 55937, DPM: 132364, Usage: 132364\n   Usage pro-rated 2024-09-01 - 2024-09-30: 129756\n\nIncluded Usage: 10000\nTotal Usage: 129756\nUsage in excess of 10000: 119756 @ $8/1000 = $958.05\nTotal Usage Amount: $958.05",
      "usages": [
        {
          "id": 1111162008,
          "stackId": 111118,
          "periodStart": "2024-09-01T00:00:00Z",
          "periodEnd": "2024-09-30T23:59:59Z",
          "totalUsage": 129755.72,
          "isProrated": false,
          "activeSeries": 55937,
          "dpm": 132364,
          "stackName": "example.grafana.net",
          "stackLabels": {}
        }
      ]
    },
    {
      "id": 1111195084,
      "dimensionId": "hg",
      "dimensionName": "Grafana Users",
      "unit": "user",
      "includedUsage": 3,
      "totalUsage": 14,
      "overage": 11,
      "orgRates": {
        "tiers": [
          {
            "min": 3,
            "rate": 8
          }
        ]
      },
      "amountDue": 88,
      "periodStart": "2024-09-01T00:00:00Z",
      "periodEnd": "2024-09-30T23:59:59Z",
      "description": "Hosted Grafana Usage - September 2024",
      "notes": "Per-instance Usage\n - example.grafana.net - Total Unique Users: 14\n\nIncluded Users: 3\nTotal Unique Users: 14\nUsers in excess of 3: 11 @ $8/User = $88.00\nTotal Usage Amount: $88.00",
      "usages": [
        {
          "id": 1111157272,
          "stackId": 111118,
          "periodStart": "2024-09-01T00:00:00Z",
          "periodEnd": "2024-09-30T23:59:59Z",
          "totalUsage": 14,
          "isProrated": false,
          "grafanaUsage": 14,
          "onCallUsage": 0,
          "stackName": "example.grafana.net",
          "stackLabels": {}
        }
      ]
    }
  ]
}
```
