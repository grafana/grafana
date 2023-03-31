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
title: Inspect variables
weight: 200
---

# Inspect variables

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add]({{< relref "./add-template-variables/" >}}) and [manage variables]({{< relref "./add-template-variables/#manage-variables" >}}) on this page.

> **Note:** This feature is available in Grafana 7.4 and later versions.

![Variables list](/static/img/docs/variables-templates/variables-list-7-4.png)

Any variable that is referenced or used has a green check mark next to it, while unreferenced variables have a orange caution icon next to them.

![Variables list](/static/img/docs/variables-templates/variable-not-referenced-7-4.png)

In addition, there is an option to show the dependencies between variables. Before 9.2 all referenced variables have a dependency icon next to the green check mark. You can click on the icon to view the dependency map. After 9.2, it is a button under the list of variables. 
The dependency map can be moved. You can zoom in out with mouse wheel or track pad equivalent.

![Variables list](/static/img/docs/variables-templates/dependancy-map-7-4.png)
