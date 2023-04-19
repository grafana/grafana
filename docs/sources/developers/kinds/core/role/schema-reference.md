---
keywords:
  - grafana
  - schema
title: Role kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## Role

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

Authz Role definition

| Property      | Type    | Required | Default | Description                  |
|---------------|---------|----------|---------|------------------------------|
| `groupName`   | string  | **Yes**  |         | Role group name              |
| `hidden`      | boolean | **Yes**  |         |                              |
| `id`          | string  | **Yes**  |         | Role internal name.          |
| `namespace`   | string  | **Yes**  |         | Namespace aka tenant/org id. |
| `title`       | string  | **Yes**  |         | Role display name.           |
| `uid`         | string  | **Yes**  |         | Unique role uid.             |
| `version`     | string  | **Yes**  |         |                              |
| `description` | string  | No       |         | Description of the role.     |


