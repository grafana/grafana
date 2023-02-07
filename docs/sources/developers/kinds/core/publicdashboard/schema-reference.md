---
keywords:
  - grafana
  - schema
title: PublicDashboard kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## PublicDashboard

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

Public dashboard configuration

| Property               | Type    | Required | Description                                                     |
|------------------------|---------|----------|-----------------------------------------------------------------|
| `annotationsEnabled`   | boolean | **Yes**  | Flag that indicates if annotations are enabled                  |
| `dashboardUid`         | string  | **Yes**  | Dashboard unique identifier referenced by this public dashboard |
| `isEnabled`            | boolean | **Yes**  | Flag that indicates if the public dashboard is enabled          |
| `timeSelectionEnabled` | boolean | **Yes**  | Flag that indicates if the time range picker is enabled         |
| `uid`                  | string  | **Yes**  | Unique public dashboard identifier                              |
| `accessToken`          | string  | No       | Unique public access token                                      |


