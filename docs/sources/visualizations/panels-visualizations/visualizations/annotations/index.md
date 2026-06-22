---
aliases:
  - ../../../features/panels/annotations/ # /docs/grafana/next/features/panels/annotations/
  - ../../../panels/visualizations/annotations/ # /docs/grafana/next/panels/visualizations/annotations/
  - ../../annotations/ # /docs/grafana/next/visualizations/annotations/
  - ../../../panels-visualizations/visualizations/annotations/ # /docs/grafana/next/panels-visualizations/visualizations/annotations/
description: Configure options for Grafana's annotations list visualization
keywords:
  - grafana
  - Annotations
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Annotations list
weight: 100
---

# Annotations list

The annotations list shows a list of available annotations you can use to view annotated data. Various options are available to filter the list based on tags and on the current dashboard.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-annotations-list-viz-v12.0.png" max-width="750px" alt="The annotations list visualization" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Annotation query options

The following options control the source query for the list of annotations:

<!-- prettier-ignore-start -->

| Option     | Description                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| [Query filter](#query-filter) | Specify which annotations are included in the list.  |
| [Time range](#time-range) | Specify whether the list should be limited to the current time range. |
| Tags | Filter the annotations by tags. You can add multiple tags to refine the list. Tag values support dashboard variable interpolation, for example `$my_var` or `${my_var}`. Optionally, leave the tag list empty and filter in view mode by selecting tags that are listed as part of the results on the panel itself. |
| Limit | Limit the number of results returned. The default is `10`. |

<!-- prettier-ignore-end -->

#### Query filter

Use the **Query filter** option to create a list of annotations from all dashboards in your organization or the current dashboard in which this panel is located.
Choose from:

- **All dashboards** - List annotations from all dashboards in the current organization.
- **This dashboard** - Limit the list to the annotations on the current dashboard.

#### Time range

Specify whether the list should be limited to the current time range.
Choose from:

- **None** - No time range limit for the annotations query.
- **This dashboard** - Limit the list to the time range of the dashboard where the annotations list is available.

### Display options

These options control additional metadata included in the annotations list display:

<!-- prettier-ignore-start -->

| Option     | Description                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Show user | Show or hide which user created the annotation.  |
| Show time | Show or hide the time the annotation creation time. |
| Show tags | Show or hide the tags associated with an annotation. Note that you can use the tags to filter the annotations list. |
| Filter by user in panel | Click a user's avatar in the list to filter results to annotations created by that user. A **Filter:** bar appears with a control to clear the user filter. |

<!-- prettier-ignore-end -->

### Link behavior options

Use the following options to control the behavior of annotation links in the list:

<!-- prettier-ignore-start -->

| Option     | Description                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Link target | Set how to view the annotated data. The default is **Panel**. Choose from:<ul><li>**Panel** - On the current dashboard, opens a full-screen view of the panel when the annotation has a panel ID. On a different dashboard, navigates to that dashboard with the configured time range.</li><li>**Dashboard** - Navigates to the annotation's dashboard, or updates the current dashboard time range, using the configured time window.</li></ul> |
| Time before | Set the time range before the annotation. Use duration string values like `1h` for one hour and `10m` for 10 minutes. The default is `10m`. |
| Time after | Set the time range after the annotation. The default is `10m`. |

<!-- prettier-ignore-end -->
