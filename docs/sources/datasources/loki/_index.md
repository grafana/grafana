---
aliases:
  - ../data-sources/loki/
  - ../features/datasources/loki/
description: Guide for using Loki in Grafana
keywords:
  - grafana
  - loki
  - logging
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Loki
title: Configure the Loki data source
weight: 800
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  logs-integration-labels-and-detected-fields:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
---

# Loki data source

Grafana Loki is a set of components that can be combined into a fully featured logging stack.
Unlike other logging systems, Loki is built around the idea of only indexing metadata about your logs: labels (just like Prometheus labels). Log data itself is then compressed and stored in chunks in object stores such as S3 or GCS, or even locally on a filesystem.

The following guides will help you get started with Loki:

- [Getting started with Loki](/docs/loki/latest/get-started/)
- [Install Loki](/docs/loki/latest/installation/)
- [Loki best practices](/docs/loki/latest/best-practices/#best-practices)
- [Configure the Loki data source](/docs/grafana/latest/datasources/loki/configure-loki-data-source/)
- [LogQL](/docs/loki/latest/logql/)
- [Loki query editor](query-editor/)

## Supported Loki versions

This data source supports these versions of Loki:

- v2.8+

## Adding a data source

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management)
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

Once you've added the Loki data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards), use [Explore](ref:explore), and [annotate visualizations](query-editor/#apply-annotations).

{{% admonition type="note" %}}
To troubleshoot configuration and other issues, check the log file located at `/var/log/grafana/grafana.log` on Unix systems, or in `<grafana_install_dir>/data/log` on other platforms and manual installations.
{{% /admonition %}}

## Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

### Provisioning examples

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    jsonData:
      timeout: 60
      maxLines: 1000
```

**Using basic authorization and a derived field:**

You must escape the dollar (`$`) character in YAML values because it can be used to interpolate environment variables:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    basicAuth: true
    basicAuthUser: my_user
    jsonData:
      maxLines: 1000
      derivedFields:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          # url will be interpreted as query for the datasource
          url: '$${__value.raw}'
          # optional for URL Label to set a custom display label for the link.
          urlDisplayLabel: 'View Trace'

        # Field with external link.
        - matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: 'http://localhost:16686/trace/$${__value.raw}'
    secureJsonData:
      basicAuthPassword: test_password
```

**Using a Jaeger data source:**

In this example, the Jaeger data source's `uid` value should match the Loki data source's `datasourceUid` value.

```
datasources:
    - name: Jaeger
      type: jaeger
      url: http://jaeger-tracing-query:16686/
      access: proxy
      # UID should match the datasourceUid in derivedFields.
      uid: my_jaeger_uid
```

## Query the data source

The Loki data source's query editor helps you create log and metric queries that use Loki's query language, [LogQL](/docs/loki/latest/logql/).

For details, refer to the [query editor documentation](query-editor/).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation](template-variables/).
