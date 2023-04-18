---
aliases:
  - ../reference/templating/
keywords:
  - grafana
  - templating
  - documentation
  - guide
  - template
  - variable
title: Inspect variables
weight: 125
---

# Inspect variables and their dependencies

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add]({{< relref "variable-types/_index.md" >}}) variables and [manage]({{< relref "manage-variable.md" >}}) existing variables from this page.

> **Note:** This feature is available in Grafana 7.4 and later versions.

![Variables list](/static/img/docs/variables-templates/variables-list-7-4.png)

Any variable that is referenced or used has a green check mark next to it, while unreferenced variables have a orange caution icon next to them.

![Variables list](/static/img/docs/variables-templates/variable-not-referenced-7-4.png)

In addition, all referenced variables have a dependency icon next to the green check mark. You can click on the icon to view the dependency map. The dependency map can be moved. You can zoom in out with mouse wheel or track pad equivalent.

![Variables list](/static/img/docs/variables-templates/dependancy-map-7-4.png)
