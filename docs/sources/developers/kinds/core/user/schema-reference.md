---
keywords:
  - grafana
  - schema
title: User kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## User

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

User model

| Property           | Type               | Required | Description                                                                  |
|--------------------|--------------------|----------|------------------------------------------------------------------------------|
| `accessControl`    | map[string]boolean | **Yes**  | AccessControl metadata associated with a given resource.                     |
| `authLabels`       | string[]           | **Yes**  | AuthLabels is a list of authentication providers used (OAuth, SAML, LDAP...) |
| `avatarUrl`        | string             | **Yes**  | AvatarUrl is the user's avatar URL.                                          |
| `createdAt`        | integer            | **Yes**  | CreatedAt indicates when the user was created.                               |
| `email`            | string             | **Yes**  | Email is the user's email.                                                   |
| `isDisabled`       | boolean            | **Yes**  | IsDisabled indicates if the user is disabled.                                |
| `isExternalSynced` | boolean            | **Yes**  | IsExternalSynced indicates if the user is synchronized externally.           |
| `isExternal`       | boolean            | **Yes**  | IsDisabled indicates if the user is external.                                |
| `isGrafanaAdmin`   | boolean            | **Yes**  | IsGrafanaAdmin indicates if the user belongs to Grafana.                     |
| `login`            | string             | **Yes**  | Login is the name used for login.                                            |
| `name`             | string             | **Yes**  | Name is the user's name.                                                     |
| `updatedAt`        | integer            | **Yes**  | UpdatedAt indicates when the user was updated.                               |
| `orgId`            | string             | No       | OrgId is the org where the user belongs to.                                  |
| `theme`            | string             | No       | Theme is Grafana theme used by the user.                                     |


