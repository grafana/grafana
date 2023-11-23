---
description: Guide for upgrading to Grafana v10.2
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v10.2
menuTitle: Upgrade to v10.2
weight: 1500
---

# Upgrade to Grafana v10.2

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes
- From Grafana v10.2 onwards, `/api/datasources/:id/` is removed and replaced with `/api/access-control/datasources/:uid`, to know more about the new API endpoints regarding datasource permission API please visit [here](https://grafana.com/docs/grafana/v10.2/developers/http_api/datasource_permissions/)
