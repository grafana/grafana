---
canonical: https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/
description: Create and manage alerting resources using the HTTP API
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Use the HTTP API to manage alerting resources
weight: 500
---

# Use the HTTP API to manage alerting resources (legacy)

{{< admonition type="note" >}}
This page documents the legacy Alerting Provisioning HTTP API (`/api/v1/provisioning/*`). Starting in Grafana 13, legacy `/api` endpoints are deprecated in favor of the new `/apis` endpoints.

To provision alerting resources using the new HTTP APIs, refer to [Use the new HTTP APIs to manage alerting resources](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-apis-provisioning/). For details on migrating from legacy `/api` endpoints, refer to [Migrate to the new Grafana APIs](/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration/#alerting-provisioning-api).
{{< /admonition >}}

{{< docs/shared lookup="alerts/alerting_provisioning.md" source="grafana" version="<GRAFANA_VERSION>" >}}
