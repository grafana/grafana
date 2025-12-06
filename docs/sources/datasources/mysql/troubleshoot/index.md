---
description: Learn how to troubleshoot common problems with the Grafana MySQL data source plugin
keywords:
  - grafana
  - mysql
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshoot
title: Troubleshoot common problems with the Grafana MySQL data source plugin
weight: 40
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  variable-syntax-advanced-variable-format-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#advanced-variable-format-options
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
  panel-inspector:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-inspector/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#query-editors
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#query-editors
  alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/
  template-annotations-and-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  configure-standard-options:
    - pattern: /docs/grafana/
    - destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/
---

# Troubleshoot common problems with the Grafana MySQL data source plugin

This page lists common issues you might experience when setting up the Grafana MySQL data source plugin.

### My data source connection fails when using the Grafana MySQL data source plugin

- Check if the MySQL server is up and running.
- Make sure that your firewall is open for MySQL server (default port is `3306`).
- Ensure that you have the correct permissions to access the MySQL server and also have permission to access the database.
- If the error persists, create a new user for the Grafana MySQL data source plugin with correct permissions and try to connect with it.

### What should I do if I see "An unexpected error happened" or "Could not connect to MySQL" after trying all of the above?

- Check the Grafana logs for more details about the error.
- For Grafana Cloud customers, contact support.
