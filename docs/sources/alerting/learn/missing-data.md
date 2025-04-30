---
canonical: https://grafana.com/docs/grafana/latest/alerting/learn/missing-data/
description: Declare an incident from a firing alert
keywords:
  - grafana
  - alert rules
  - incident
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Handling missing data
title: Handling missing data in Grafana Alerting
weight: 1020
refs:
  connectivity-errors-guide:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/learn/connectivity-errors/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/learn/connectivity-errors/
  connectivity-errors-reduce-alert-fatigue:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/learn/connectivity-errors/#reducing-notification-fatigue-from-datasourceerror-alerts
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/learn/connectivity-errors/
  alert-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state-history/
  configure-nodata-and-error-handling:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#modify-the-no-data-or-error-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#modify-the-no-data-or-error-state
  stale-alert-instances:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#stale-alert-instances-missingseries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#stale-alert-instances-missingseries
  no-data-and-error-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#no-data-and-error-alerts
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#no-data-and-error-alerts
---

# Handling missing data in Grafana Alerting

Declare an incident from a firing alert to streamline your alert to incident workflow.
