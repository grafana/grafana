---
keywords:
  - grafana
  - schema
title: AccessPolicy kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## AccessPolicy

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

Access rules for a scope+role

| Property | Type                        | Required | Default | Description                                                                                         |
|----------|-----------------------------|----------|---------|-----------------------------------------------------------------------------------------------------|
| `role`   | string                      | **Yes**  |         | UID for user/team/service...<br/>??? should this be a #ResourceID  but kind=user&#124;team&#124;??? |
| `rules`  | [AccessRule](#accessrule)[] | **Yes**  |         |                                                                                                     |
| `scope`  | [ResourceID](#resourceid)   | **Yes**  |         |                                                                                                     |

### AccessRule

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `action` | string | **Yes**  |         |             |
| `what`   | string | **Yes**  |         |             |

### ResourceID

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `kind`   | string | **Yes**  |         |             |
| `name`   | string | **Yes**  |         |             |


