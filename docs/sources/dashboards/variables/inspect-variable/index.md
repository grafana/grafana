---
aliases:
  - ../../reference/templating/
  - ../../variables/inspect-variable/
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
description: Review and manage your dashboard variables
refs:
  add:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/
weight: 200
---

# Manage and inspect variables

In the **Variables** tab, you can [add](ref:add) variables and [manage](#manage-variables) existing variables. You can also [inspect](#inspect-variables) variables to identify any dependencies between them. <!--whether a variable is being referenced (or used) in other variables or dashboard.-->

## Manage variables

You can take the following actions in the **Variables** tab:

- **Move** - Move a variable up or down the list using drag and drop.
- **Clone** - Clone a variable by clicking the clone icon in the set of icons on the right. This creates a copy of the variable with the name of the original variable prefixed with `copy_of_`.
- **Delete** - Delete a variable by clicking the trash icon in the set of icons on the right.

## Inspect variables

In addition to [managing variables](#manage-variables), the **Variables** tab lets you easily identify whether variables have any dependencies. To check, click **Show dependencies** at the bottom of the list, which opens the dependencies diagram:

<!-- Update and comment this back in when the reference functionality is working again

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add](ref:add) and [manage variables](#manage-variables) on this page.

![Variables list](/static/img/docs/variables-templates/variables-list-7-4.png)

Any variable that is referenced or used has a green check mark next to it, while unreferenced variables have a orange caution icon next to them.

![Variables list](/static/img/docs/variables-templates/variable-not-referenced-7-4.png)

In addition, all referenced variables have a dependency icon next to the green check mark. You can click on the icon to view the dependency map. The dependency map can be moved. You can zoom in out with mouse wheel or track pad equivalent.-->

![Variables list](/static/img/docs/variables-templates/dependancy-map-7-4.png)
