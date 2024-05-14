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
weight: 200
---

# Manage and inspect variables

The variables page lets you [add][] variables and [manage](#manage-variables) existing variables. It also allows you to [inspect](#inspect-variables) variables and identify whether a variable is being referenced (or used) in other variables or dashboard.

## Manage variables

You can take the following actions on the variables page:

**Move:** You can move a variable up or down the list using drag and drop.

**Clone:** To clone a variable, click the clone icon from the set of icons on the right. This creates a copy of the variable with the name of the original variable prefixed with `copy_of_`.

**Delete:** To delete a variable, click the trash icon from the set of icons on the right.

## Inspect variables

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add][] and [manage variables](#manage-variables) on this page.

{{% admonition type="note" %}}
This feature is available in Grafana 7.4 and later versions.
{{% /admonition %}}

![Variables list](/static/img/docs/variables-templates/variables-list-7-4.png)

Any variable that is referenced or used has a green check mark next to it, while unreferenced variables have a orange caution icon next to them.

![Variables list](/static/img/docs/variables-templates/variable-not-referenced-7-4.png)

In addition, all referenced variables have a dependency icon next to the green check mark. You can click on the icon to view the dependency map. The dependency map can be moved. You can zoom in out with mouse wheel or track pad equivalent.

![Variables list](/static/img/docs/variables-templates/dependancy-map-7-4.png)

{{% docs/reference %}}
[add]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables"
[add]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables"
{{% /docs/reference %}}
