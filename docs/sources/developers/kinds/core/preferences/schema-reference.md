---
keywords:
  - grafana
  - schema
title: Preferences kind
---

# Preferences kind

### Maturity: merged
### Version: 0.0

## Properties

| Property           | Type                                              | Required | Description                           |
|--------------------|---------------------------------------------------|----------|---------------------------------------|
| `homeDashboardUID` | string                                            | No       | UID for the home dashboard            |
| `language`         | string                                            | No       | Selected language (beta)              |
| `queryHistory`     | [QueryHistoryPreference](#queryhistorypreference) | No       |                                       |
| `theme`            | string                                            | No       | light, dark, empty is default         |
| `timezone`         | string                                            | No       | The timezone selection                |
| `weekStart`        | string                                            | No       | day of the week (sunday, monday, etc) |

## QueryHistoryPreference

### Properties

| Property  | Type   | Required | Description                                 |
|-----------|--------|----------|---------------------------------------------|
| `homeTab` | string | No       | one of: '' &#124; 'query' &#124; 'starred'; |


