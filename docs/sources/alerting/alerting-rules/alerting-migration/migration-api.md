---
description: Use the Grafana Alerting API import tool to convert your datasource managed alert rules into Grafana managed alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import data source-managed alert rules with Grafana Mimirtool
menuTitle: API alert rules import
weight: 601
refs:
---

# Import data source-managed alert rules with Grafana Mimirtool

You can convert data source-managed alert rules to Grafana-managed alert rules with the Grafana import tool in the Grafana user interface, or you can convert them with the Grafana Mimirtool command-line tool. This guide tells you how to use Mimirtool to import your data source-managed alert rules.

## Before you begin

To import data source-managed alert rules with Grafana Mimirtool, you need to have the Grafana Mimirtool command-line tool installed. 

You need a service account the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):
- Alerting: Rules Reader
- Alerting: Rules Writer
- Alerting: Set provisioning status
- Datasources: Reader
- Folders: Creator 
- Folders: Reader
- Folders: Writer

You also need to create a service account token with your service account. Refer to the [documentation for more information on service accounts and service account tokens](/docs/grafana/latest/administration/service-accounts/)

## How it works

When data source-managed alert rules are converted to Grafana-managed alert rules, the following are applied to the Grafana-managed alert rules:
- All rules are given `rule_query_offset` offset value of 1m.
- The `missing_series_evals_to_resolve` is set to 1 for the new rules.
- The newly created rules are given unique UIDs.

{{< admonition type="note" >}}
Plugin rules that have the label `__grafana_origin` are not included on alert rule imports.
{{< /admonition >}}

## Import alert rules with Mimirtool

To convert your alert rules, use the following command prompt substituting the your URL and your service account token as indicated, followed by your intended mimirtool command. For further reference, see the [Mimir HTTP API documentation](/docs/mimir/latest/references/http-api/#ruler-rules:~:text=config/v1/rules-,Get%20rule%20groups%20by%20namespace,DELETE%20%3Cprometheus%2Dhttp%2Dprefix%3E/config/v1/rules/%7Bnamespace%7D,-Delete%20tenant%20configuration) for more information about the Rule API points and examples of Mimirtool commands.

  ```bash
  MIMIR_ADDRESS=https://<Grafana URL>.grafana-dev.net/api/convert/ MIMIR_AUTH_TOKEN=<your token ID> MIMIR_TENANT_ID=1
  ```

### Compatible endpoints

The following are compatible API endpoints:

**GET**
``` 
GET /convert/prometheus/config/v1/rules - Get all rule groups across all namespaces
GET /convert/prometheus/config/v1/rules/<NamespaceTitle> - Get rule groups in a specific namespace
GET /convert/prometheus/config/v1/rules/<NamespaceTitle>/<Group> - Get a single rule group

```
**POST**
``` 
POST /convert/prometheus/config/v1/rules - Create/update multiple rule groups across multiple namespaces
POST /convert/prometheus/config/v1/rules/<NamespaceTitle> - Create/update a single rule group in a namespace
```
Post rules also require the following header:
When posting rules:
`X-Grafana-Alerting-Datasource-<UID>` - Supply the UID of the datasource to use for queries.


**Delete**
``` 
DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle} - Delete all alert rules in a namespace
DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} - Delete a specific rule group
```

**Optional Headers**

Additional configuration headers for more granular import control include the following:

`X-Grafana-Alerting-Recording-Rules-Paused` - Set to "true" to import recording rules in paused state.
`X-Grafana-Alerting-Alert-Rules-Paused` - Set to "true" to import alert rules in paused state.
`X-Grafana-Alerting-Target-Datasource-<UID>` - Enter the UID for a different target datasource for recording rules.
`X-Grafana-Alerting-Folder-UID` - Enter the UID of the target destination folder for imported rules.