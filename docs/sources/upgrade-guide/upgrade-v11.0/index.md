---
description: Guide for upgrading to Grafana v11.0-preview
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '11.0'
  - '11.0-preview'
title: Upgrade to Grafana v11.0-preview
menuTitle: Upgrade to v11.0
weight: 1200
---

# Upgrade to Grafana v11.0-preview

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

### PostgreSQL data source plugin update

<!-- Gabor Farkas -->

If you use the PostgresSQL data source plugin and store certificates using the `Certificate content` method, Grafana previously creted temporary files in grafana's [data](/docs/grafana/latest/setup-grafana/configure-grafana/#data) folder. Grafana 11 does not use temporary files for this functionality anymore. But, existing temporary files will not be deleted, we recommend deleting them manually. To find them, look for the `tls` subfolder in the `data` folder, it contains subfolders named based on plugin ids, and these subfolders contain files named `client.*` or `root.*`. These are not used anymore, and can be deleted.
