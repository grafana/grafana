---
keywords:
  - grafana
  - schema
title: TeamRole kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TeamRole

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

An association between a Team and a Role

| Property    | Type   | Required | Default | Description                                       |
|-------------|--------|----------|---------|---------------------------------------------------|
| `created`   | string | **Yes**  |         | Created indicates when the team role was created. |
| `namespace` | string | **Yes**  |         | Namespace aka tenant/org id.                      |
| `roleUid`   | string | **Yes**  |         | Unique role uid.                                  |
| `teamName`  | string | **Yes**  |         | Unique team name                                  |


