---
aliases:
  - ../../../../http_api/alerting_provisioning/ # /docs/grafana/next/http_api/alerting_provisioning/
  - ../../../../developers/http_api/alerting_provisioning/ # /docs/grafana/next/developers/http_api/alerting_provisioning/
  - ../../../../developer-resources/api-reference/http-api/alerting_provisioning/ #legacy folder
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/
description: Grafana Alerts HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - alerting
  - alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
title: 'Alerting Provisioning HTTP API '
---

# Alerting provisioning HTTP API

{{< docs/shared lookup="developers/deprecated-apis.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< admonition type="note" >}}
This API is partially replaced by two new HTTP APIs:

- **[Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/):** Replaces the alert rule and rule group endpoints. Refer to [Migrate from the legacy Alerting Provisioning API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/#migrate-from-the-legacy-alerting-provisioning-api) to learn how both APIs match.
- **[Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/):** Replaces the contact points, notification policies, notification template groups, and mute timings endpoints. Refer to [Migrate from the legacy Alerting Provisioning API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/#migrate-from-the-legacy-alerting-provisioning-api) to learn how both APIs match.

The file-provisioning `export` endpoints and receiver permission endpoints don't have equivalents in the new APIs yet and remain available here.
{{< /admonition >}}

{{< docs/shared lookup="alerts/alerting_provisioning.md" source="grafana" version="<GRAFANA_VERSION>" >}}
