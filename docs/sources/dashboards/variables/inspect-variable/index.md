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
title: Inspect variables
weight: 200
---

# Inspect variables

The variables page lets you easily identify whether a variable is being referenced (or used) in other variables or dashboard. In addition, you can also [add][] and [manage variables][] on this page.

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
