---
description: A reference for the JSON links schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - links
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: links schema
title: links
weight: 500
---

# `links`

The `links` schema is the configuration for links with references to other dashboards or external websites.
Following are the default JSON fields:

```json
  "links": [
    {
      "asDropdown": false,
      "icon": "",
      "includeVars": false,
      "keepTime": false,
      "tags": [],
      "targetBlank": false,
      "title": "",
      "tooltip": "",
      "type": "link",
    },
  ],
```

## `DashboardLink`

The following table explains the usage of the dashboard link JSON fields.
The table includes default and other fields:

<!-- prettier-ignore-start -->

| Name        | Usage                                   |
| ----------- | --------------------------------------- |
| title       | string. Title to display with the link. |
| type        | `DashboardLinkType`. Link type. Accepted values are:<ul><li>dashboards - To refer to another dashboard</li><li>link - To refer to an external resource</li></ul> |
| icon        | string. Icon name to be displayed with the link. |
| tooltip     | string. Tooltip to display when the user hovers their mouse over it. |
| url?        | string. Link URL. Only required/valid if the type is link. |
| tags        | string. List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards. |
| asDropdown  | bool. If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards. Default is `false`. |
| targetBlank | bool. If true, the link will be opened in a new tab. Default is `false`. |
| includeVars | bool. If true, includes current template variables values in the link as query params. Default is `false`. |
| keepTime    | bool. If true, includes current time range in the link as query params. Default is `false`. |

<!-- prettier-ignore-end -->
