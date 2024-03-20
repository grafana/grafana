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

If you use the PostgreSQL data source plugin and store certificates using the `Certificate content` method, we previously created temporary files in the Grafana [data](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#data) folder. Grafana 11 doesn't use temporary files for this functionality anymore. However, existing temporary files won't be deleted; we recommend deleting them manually. To find them, look for the `tls` subfolder in the `data` folder. It contains subfolders that are named based on plugin ids, and these subfolders contain files named `client.*` or `root.*`. These aren't used anymore, and can be deleted.
