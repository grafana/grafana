---
description: Guide for upgrading to Grafana v13.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '13.0'
title: Upgrade to Grafana v13.0
menuTitle: Upgrade to v13.0
weight: 497
---

# Upgrade to Grafana v13.0

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### React 19 related updates
As part of our [migration in Grafana 13 to React 19](https://grafana.com/blog/react-19-is-coming-to-grafana-what-plugin-developers-need-to-know/#next-steps-and-how-to-learn-more) - we recommend you to follow this order of update flow to ensure that your plugins are working properly and you have no disruptions during Grafana 13 upgrade.

Follow this sequence for best results:

#### Upgrade your grafana to latest patch version for the version you are running
To ensure that the changes that are necessary for React 19 upgrade are in place in your Grafana version, please update to the latest minor version available for your Grafana. You can check which one it is on our [downloads page](https://grafana.com/grafana/download)

#### Update all of your plugins
To get the latest version of each installed plugin and increase the chance that it has all the necessary code updated to support React 19 - please update all of your installed plugins and check if they are still working properly.

#### Upgrade to Grafana 13
Finally you can continue your upgrade to Grafana 13.