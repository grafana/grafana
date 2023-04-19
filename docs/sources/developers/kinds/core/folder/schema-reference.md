---
keywords:
  - grafana
  - schema
title: Folder kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## Folder

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

A collection of items together

| Property      | Type   | Required | Default | Description                          |
|---------------|--------|----------|---------|--------------------------------------|
| `title`       | string | **Yes**  |         | Folder title                         |
| `uid`         | string | **Yes**  |         | Unique folder id. (will be k8s name) |
| `description` | string | No       |         | Description of the folder.           |


