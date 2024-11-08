---
aliases:
  - unified-alerting/set-up/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/set-up/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/
description: Advanced configuration for Grafana Alerting
labels:
  products:
    - oss
menuTitle: Additional configuration
title: Additional configuration
weight: 160
refs:
  terraform-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  configure-high-availability:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-high-availability/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-high-availability/
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  data-source-management:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  data-source-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/#supported-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/#supported-data-sources
  file-provisioning:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/
  alerting-permissions:
    - pattern: /docs/
    - destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-roles//alerting/set-up/configure-roles/
  alerting-rbac:
    - pattern: /docs/
    - destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-rbac/
  alert-state-history:
    - pattern: /docs/
    - destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alert-state-history/
---

# Additional configuration

Grafana Alerting offers a variety of advanced configuration options to further tailor your alerting setup. These optional features include configuring up permissions and role-based access control, adding external Alertmanagers, or defining your alerting setup as code. While not essential for basic alerting, these options can enhance security, scalability, and automation in complex environments.

The following topics provide you with advanced configuration options for Grafana Alerting.

- [Configure roles and permissions](ref:alerting-permissions)
- [Configure RBAC](ref:alerting-rbac)
- [Configure alert state history](ref:alert-state-history)
- [Use configuration files to provision](ref:file-provisioning)
- [Use Terraform to provision](ref:terraform-provisioning)
- [Configure Alertmanagers](ref:configure-alertmanager)
- [Configure high availability](ref:configure-high-availability)
