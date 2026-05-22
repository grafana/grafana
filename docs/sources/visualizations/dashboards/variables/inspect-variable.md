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

In the **Variables** tab, you can [add](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/) variables and [manage](#manage-variables) existing variables. You can also [inspect](#inspect-variables) variables to identify any dependencies between them.

<!--whether a variable is being referenced (or used) in other variables or dashboard.-->

## Manage variables

You can take the following actions in the **Variables** tab:

- **Move**: Move a variable up or down the list using drag and drop.
- **Clone**: Clone a variable by clicking the clone icon in the set of icons on the right. This creates a copy of the variable with the name of the original variable prefixed with `copy_of_`.
- **Delete**: Delete a variable by clicking the trash icon in the set of icons on the right.

## Inspect variables

In addition to [managing variables](#manage-variables), the **Variables** tab lets you quickly identify whether variables have any dependencies. To check, click **Show dependencies** at the bottom of the list, which opens the dependencies diagram:

<!-- Update and comment this back in when the reference functionality is working again

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/) and [manage variables](#manage-variables) on this page.

![Variables list](/static/img/docs/variables-templates/variables-list-7-4.png)

Any variable that is referenced or used has a green check mark next to it, while unreferenced variables have a orange caution icon next to them.

![Variables list](/static/img/docs/variables-templates/variable-not-referenced-7-4.png)

In addition, all referenced variables have a dependency icon next to the green check mark. You can click on the icon to view the dependency map. The dependency map can be moved. You can zoom in out with mouse wheel or track pad equivalent.-->

![Dependency map showing relationships between dashboard variables](/static/img/docs/variables-templates/dependancy-map-7-4.png)
