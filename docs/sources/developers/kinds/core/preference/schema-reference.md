---
keywords:
  - grafana
  - schema
title: Preference kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# Preference kind

## Maturity: merged
## Version: 0.0

## Properties

| Property           | Type                                              | Required | Description                                                                                                                 |
|--------------------|---------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------|
| `homeDashboardId`  | integer                                           | No       | Numeric unique identifier for the home dashboard                                                                            |
| `homeDashboardUID` | string                                            | No       | Unique identifier for the home dashboard                                                                                    |
| `language`         | string                                            | No       | Language preference                                                                                                         |
| `navbar`           | [NavbarPreference](#navbarpreference)             | No       |                                                                                                                             |
| `queryHistory`     | [QueryHistoryPreference](#queryhistorypreference) | No       |                                                                                                                             |
| `theme`            | string                                            | No       | Theme preference Possible values are: `dark`, `light`.                                                                      |
| `timezone`         | string                                            | No       | Timezone preference Possible values are: `utc`, `browser`.                                                                  |
| `weekStart`        | string                                            | No       | Starting day of the week Possible values are: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`. |

## NavbarPreference

### Properties

| Property     | Type                  | Required | Description |
|--------------|-----------------------|----------|-------------|
| `savedItems` | [NavLink](#navlink)[] | **Yes**  |             |

### NavLink

#### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `id`     | string | No       |             |
| `target` | string | No       |             |
| `text`   | string | No       |             |
| `url`    | string | No       |             |

## QueryHistoryPreference

### Properties

| Property  | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `homeTab` | string | No       |             |


