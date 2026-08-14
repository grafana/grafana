---
aliases:
  - ../../../variables/inspect-variable/ # /docs/grafana/next/variables/inspect-variable/
  - ../../../variables/manage-variable/ # /docs/grafana/next/variables/manage-variable/
  - ../../../dashboards/variables/inspect-variable/ # /docs/grafana/next/dashboards/variables/inspect-variable/
keywords:
  - grafana
  - templating
  - documentation
  - guide
  - template
  - variable
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Manage and inspect variables
menuTitle: Inspect variables
description: Manage dashboard variables by moving, cloning, and deleting them, and inspect variable dependencies in the dashboard variables list.
weight: 500
---

# Manage and inspect variables

In the **Variables** section of the sidebar, you can [add](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/) variables and manage existing variables. You can also inspect variables to identify any dependencies between them.

{{< figure src="/media/docs/grafana/dashboards/screenshot-manage-variables-v13.2.png" max-width="400px" alt="Variables section of the dashboard options in the sidebar" >}}

## Manage variables

You can take the following actions in the **Variables** section of the sidebar:

- **Edit**: Click **Select** on the control to open it in the sidebar so you can make updates. Then you can access the following options:
  - **Duplicate**: Duplicate a variable by clicking the clone icon the sidebar header. This creates a copy of the variable with the name of the original variable prefixed with `copy` and the number of the copy; for example, "copy1".
  - **Delete**: Delete a variable by clicking the trash icon in sidebar header.
- **Reorder**: Drag and drop controls to reorder them.
- **Change display**: Drag and drop controls between sub-sections **Above dashboard**, **Controls menu**, and **Hidden** to update the control display option. Note that links can't be hidden.

## Inspect variables

In addition to managing variables, the **Variables** section lets you quickly identify whether variables have any dependencies.
To check, click **Show dependencies** at the bottom of the list, which opens the dependencies diagram:

{{< figure src="/media/docs/grafana/dashboards/screenshot-variable-dependencies-v13.2.png" max-width="600px" alt="Dependency map showing relationships between dashboard variables" >}}
