+++
title = "Using Google Cloud Monitoring in Grafana"
description = "Guide for using Google Cloud Monitoring in Grafana"
keywords = ["grafana", "stackdriver", "google", "guide", "cloud", "monitoring"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/stackdriver", "/docs/grafana/latest/features/datasources/stackdriver/"]
[menu.docs]
name = "Google Cloud Monitoring"
parent = "datasources"
weight = 4
+++

# Using Google Cloud Monitoring in Grafana

> Officially released in Grafana v6.0.0

> Before Grafana v7.1 this data source was named Google Stackdriver.

Grafana ships with built-in support for Google Cloud Monitoring. Just add it as a data source and you are ready to build dashboards for your Google Cloud Monitoring metrics.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Google Cloud Monitoring` from the _Type_ dropdown.
5. Upload or paste in the Service Account Key file. See below for steps on how to create a Service Account Key file.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

| Name                  | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| _Name_                | The data source name. This is how you refer to the data source in panels and queries. |
| _Default_             | Default data source means that it will be pre-selected for new panels.                |
| _Service Account Key_ | Service Account Key File for a GCP Project. Instructions below on how to create it.   |

## Authentication

There are two ways to authenticate the Google Cloud Monitoring plugin - either by uploading a Google JWT file, or by automatically retrieving credentials from Google metadata server. The latter option is only available when running Grafana on GCE virtual machine.

### Using a Google Service Account Key File

To authenticate with the Google Cloud Monitoring API, you need to create a Google Cloud Platform (GCP) Service Account for the Project you want to show data for. A Grafana data source integrates with one GCP Project. If you want to visualize data from multiple GCP Projects then you need to create one data source per GCP Project.

#### Enable APIs

The following APIs need to be enabled first:

- [Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com)
- [Cloud Resource Manager API](https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com)

Click on the links above and click the `Enable` button:

{{< docs-imagebox img="/img/docs/v71/cloudmonitoring_enable_api.png" class="docs-image--no-shadow" caption="Enable GCP APIs" >}}

#### Create a GCP Service Account for a Project

1. Navigate to the [APIs and Services Credentials page](https://console.cloud.google.com/apis/credentials).
2. Click on the `Create credentials` dropdown/button and choose the `Service account key` option.

   {{< docs-imagebox img="/img/docs/v71/cloudmonitoring_create_service_account_button.png" class="docs-image--no-shadow" caption="Create service account button" >}}

3. On the `Create service account key` page, choose key type `JSON`. Then in the `Service Account` dropdown, choose the `New service account` option:

   {{< docs-imagebox img="/img/docs/v71/cloudmonitoring_create_service_account_key.png" class="docs-image--no-shadow" caption="Create service account key" >}}

4. Some new fields will appear. Fill in a name for the service account in the `Service account name` field and then choose the `Monitoring Viewer` role from the `Role` dropdown:

   {{< docs-imagebox img="/img/docs/v71/cloudmonitoring_service_account_choose_role.png" class="docs-image--no-shadow" caption="Choose role" >}}

5. Click the Create button. A JSON key file will be created and downloaded to your computer. Store this file in a secure place as it allows access to your Google Cloud Monitoring data.
6. Upload it to Grafana on the data source Configuration page. You can either upload the file or paste in the contents of the file.

   {{< docs-imagebox img="/img/docs/v71/cloudmonitoring_grafana_upload_key.png" class="docs-image--no-shadow" caption="Upload service key file to Grafana" >}}

7. The file contents will be encrypted and saved in the Grafana database. Don't forget to save after uploading the file!

   {{< docs-imagebox img="/img/docs/v71/cloudmonitoring_grafana_key_uploaded.png" class="docs-image--no-shadow" caption="Service key file is uploaded to Grafana" >}}

### Using GCE Default Service Account

If Grafana is running on a Google Compute Engine (GCE) virtual machine, it is possible for Grafana to automatically retrieve default credentials from the metadata server. This has the advantage of not needing to generate a private key file for the service account and also not having to upload the file to Grafana. However for this to work, there are a few preconditions that need to be met.

1. First of all, you need to create a Service Account that can be used by the GCE virtual machine. See detailed instructions on how to do that [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#createanewserviceaccount).
2. Make sure the GCE virtual machine instance is being run as the service account that you just created. See instructions [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#using).
3. Allow access to the `Cloud Monitoring Monitoring API` scope.

Read more about creating and enabling service accounts for GCE VM instances [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).

## Using the Query Editor

The Google Cloud Monitoring query editor allows you to build two types of queries - **Metric** and **Service Level Objective (SLO)**. Both types return time series data.

### Metric Queries

{{< docs-imagebox img="/img/docs/v70/metric-query-builder.png" max-width= "400px" class="docs-image--right" >}}

The metric query editor allows you to select metrics, group/aggregate by labels and by time, and use filters to specify which time series you want in the results.

To create a metric query, follow these steps:

1. Choose the option **Metrics** in the **Query Type** dropdown
2. Choose a project from the **Project** dropdown
3. Choose a Google Cloud Platform service from the **Service** dropdown
4. Choose a metric from the **Metric** dropdown.
5. Use the plus and minus icons in the filter and group by sections to add/remove filters or group by clauses. This step is optional.

Google Cloud Monitoring metrics can be of different kinds (GAUGE, DELTA, CUMULATIVE) and these kinds have support for different aggregation options (reducers and aligners). The Grafana query editor shows the list of available aggregation methods for a selected metric and sets a default reducer and aligner when you select the metric. Units for the Y-axis are also automatically selected by the query editor.

#### Filter

To add a filter, click the plus icon and choose a field to filter by and enter a filter value e.g. `instance_name = grafana-1`. You can remove the filter by clicking on the filter name and select `--remove filter--`.

##### Simple wildcards

When the operator is set to `=` or `!=` it is possible to add wildcards to the filter value field. E.g `us-*` will capture all values that starts with "us-" and `*central-a` will capture all values that ends with "central-a". `*-central-*` captures all values that has the substring of -central-. Simple wildcards are less expensive than regular expressions.

##### Regular expressions

When the operator is set to `=~` or `!=~` it is possible to add regular expressions to the filter value field. E.g `us-central[1-3]-[af]` would match all values that starts with "us-central", is followed by a number in the range of 1 to 3, a dash and then either an "a" or an "f". Leading and trailing slashes are not needed when creating regular expressions.

#### Aggregation

The aggregation field lets you combine time series based on common statistics. Read more about this option [here](https://cloud.google.com/monitoring/charts/metrics-selector#aggregation-options).

The `Aligner` field allows you to align multiple time series after the same group by time interval. Read more about how it works [here](https://cloud.google.com/monitoring/charts/metrics-selector#alignment).

##### Alignment Period/Group by Time

The `Alignment Period` groups a metric by time if an aggregation is chosen. The default is to use the GCP Google Cloud Monitoring default groupings (which allows you to compare graphs in Grafana with graphs in the Google Cloud Monitoring UI).
The option is called `cloud monitoring auto` and the defaults are:

- 1m for time ranges < 23 hours
- 5m for time ranges >= 23 hours and < 6 days
- 1h for time ranges >= 6 days

The other automatic option is `grafana auto`. This will automatically set the group by time depending on the time range chosen and the width of the graph panel. Read more about the details [here](http://docs.grafana.org/variables/templates-and-variables/#the-interval-variable).

It is also possible to choose fixed time intervals to group by, like `1h` or `1d`.

#### Group By

Group by resource or metric labels to reduce the number of time series and to aggregate the results by a group by. E.g. Group by instance_name to see an aggregated metric for a Compute instance.

##### Metadata labels

Resource metadata labels contain information to uniquely identify a resource in Google Cloud. Metadata labels are only returned in the time series response if they're part of the **Group By** segment in the time series request. There's no API for retrieving metadata labels, so it's not possible to populate the group by dropdown with the metadata labels that are available for the selected service and metric. However, the **Group By** field dropdown comes with a pre-defined list of common system labels.

User labels cannot be pre-defined, but it's possible to enter them manually in the **Group By** field. If a metadata label, user label or system label is included in the **Group By** segment, then you can create filters based on it and expand its value on the **Alias** field.

#### Alias patterns

The Alias By field allows you to control the format of the legend keys. The default is to show the metric name and labels. This can be long and hard to read. Using the following patterns in the alias field, you can format the legend key the way you want it.

#### Metric Type Patterns

| Alias Pattern        | Description                  | Example Result                                    |
| -------------------- | ---------------------------- | ------------------------------------------------- |
| `{{metric.type}}`    | returns the full Metric Type | `compute.googleapis.com/instance/cpu/utilization` |
| `{{metric.name}}`    | returns the metric name part | `instance/cpu/utilization`                        |
| `{{metric.service}}` | returns the service part     | `compute`                                         |

#### Label Patterns

In the Group By dropdown, you can see a list of metric and resource labels for a metric. These can be included in the legend key using alias patterns.

| Alias Pattern Format             | Description                              | Alias Pattern Example             | Example Result   |
| -------------------------------- | ---------------------------------------- | --------------------------------- | ---------------- |
| `{{metric.label.xxx}}`           | returns the metric label value           | `{{metric.label.instance_name}}`  | `grafana-1-prod` |
| `{{resource.label.xxx}}`         | returns the resource label value         | `{{resource.label.zone}}`         | `us-east1-b`     |
| `{{metadata.system_labels.xxx}}` | returns the meta data system label value | `{{metadata.system_labels.name}}` | `grafana`        |
| `{{metadata.user_labels.xxx}}`   | returns the meta data user label value   | `{{metadata.user_labels.tag}}`    | `production`     |

Example Alias By: `{{metric.type}} - {{metric.labels.instance_name}}`

Example Result: `compute.googleapis.com/instance/cpu/usage_time - server1-prod`

It is also possible to resolve the name of the Monitored Resource Type.

| Alias Pattern Format | Description                                     | Example Result |
| -------------------- | ----------------------------------------------- | -------------- |
| `{{resource.type}}`  | returns the name of the monitored resource type | `gce_instance` |

Example Alias By: `{{resource.type}} - {{metric.type}}`

Example Result: `gce_instance - compute.googleapis.com/instance/cpu/usage_time`

### SLO (Service Level Objective) queries

> Only available in Grafana v7.0+

{{< docs-imagebox img="/img/docs/v70/slo-query-builder.png" max-width= "400px" class="docs-image--right" >}}

The SLO query builder in the Google Cloud Monitoring data source allows you to display SLO data in time series format. To get an understanding of the basic concepts in service monitoring, please refer to Google Cloud Monitoring's [official docs](https://cloud.google.com/monitoring/service-monitoring).

#### How to create an SLO query

To create an SLO query, follow these steps:

1. Choose the option **Service Level Objectives (SLO)** in the **Query Type** dropdown.
2. Choose a project from the **Project** dropdown.
3. Choose an [SLO service](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/services) from the **Service** dropdown.
4. Choose an [SLO](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/services.serviceLevelObjectives) from the **SLO** dropdown.
5. Choose a [time series selector](https://cloud.google.com/monitoring/service-monitoring/timeseries-selectors#ts-selector-list) from the **Selector** dropdown.

The friendly names for the time series selectors are shown in Grafana. Here is the mapping from the friendly name to the system name that is used in the Service Monitoring documentation:

| Selector dropdown value    | Corresponding time series selector used |
| -------------------------- | --------------------------------------- |
| SLI Value                  | select_slo_health                       |
| SLO Compliance             | select_slo_compliance                   |
| SLO Error Budget Remaining | select_slo_budget_fraction              |

#### Alias Patterns for SLO queries

The Alias By field allows you to control the format of the legend keys for SLO queries too.

| Alias Pattern  | Description                  | Example Result      |
| -------------- | ---------------------------- | ------------------- |
| `{{project}}`  | returns the GCP project name | `myProject`         |
| `{{service}}`  | returns the service name     | `myService`         |
| `{{slo}}`      | returns the SLO              | `latency-slo`       |
| `{{selector}}` | returns the selector         | `select_slo_health` |

#### Alignment Period/Group by Time for SLO queries

SLO queries use the same [alignment period functionality as metric queries]({{< relref "#metric-queries" >}}).

## Templating

Instead of hard-coding things like server, application and sensor name in your metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data
being displayed in your dashboard.

Check out the [Templating]({{< relref "../../variables/templates-and-variables.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query Variable

Variable of the type _Query_ allows you to query Google Cloud Monitoring for various types of data. The Google Cloud Monitoring data source plugin provides the following `Query Types`.

| Name                             | Description                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| _Metric Types_                   | Returns a list of metric type names that are available for the specified service.                             |
| _Labels Keys_                    | Returns a list of keys for `metric label` and `resource label` in the specified metric.                       |
| _Labels Values_                  | Returns a list of values for the label in the specified metric.                                               |
| _Resource Types_                 | Returns a list of resource types for the specified metric.                                                    |
| _Aggregations_                   | Returns a list of aggregations (cross series reducers) for the specified metric.                              |
| _Aligners_                       | Returns a list of aligners (per series aligners) for the specified metric.                                    |
| _Alignment periods_              | Returns a list of all alignment periods that are available in Google Cloud Monitoring query editor in Grafana |
| _Selectors_                      | Returns a list of selectors that can be used in SLO (Service Level Objectives) queries                        |
| _SLO Services_                   | Returns a list of Service Monitoring services that can be used in SLO queries                                 |
| _Service Level Objectives (SLO)_ | Returns a list of SLO's for the specified SLO service                                                         |

### Using variables in queries

There are two syntaxes:

- `$<varname>` Example: `metric.label.$metric_label`
- `[[varname]]` Example: `metric.label.[[metric_label]]`

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the _Multi-value_ or _Include all value_ options are enabled, Grafana converts the labels from plain text to a regex compatible string, which means you have to use `=~` instead of `=`.

## Annotations

{{< docs-imagebox img="/img/docs/v71/cloudmonitoring_annotations_query_editor.png" max-width= "400px" class="docs-image--right" >}}

[Annotations]({{< relref "../../dashboards/annotations.md" >}}) allow you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view. Annotation rendering is expensive so it is important to limit the number of rows returned. There is no support for showing Google Cloud Monitoring annotations and events yet but it works well with [custom metrics](https://cloud.google.com/monitoring/custom-metrics/) in Google Cloud Monitoring.

With the query editor for annotations, you can select a metric and filters. The `Title` and `Text` fields support templating and can use data returned from the query. For example, the Title field could have the following text:

`{{metric.type}} has value: {{metric.value}}`

Example Result: `monitoring.googleapis.com/uptime_check/http_status has this value: 502`

### Patterns for the Annotation Query Editor

| Alias Pattern Format     | Description                      | Alias Pattern Example            | Example Result                                    |
| ------------------------ | -------------------------------- | -------------------------------- | ------------------------------------------------- |
| `{{metric.value}}`       | value of the metric/point        | `{{metric.value}}`               | `555`                                             |
| `{{metric.type}}`        | returns the full Metric Type     | `{{metric.type}}`                | `compute.googleapis.com/instance/cpu/utilization` |
| `{{metric.name}}`        | returns the metric name part     | `{{metric.name}}`                | `instance/cpu/utilization`                        |
| `{{metric.service}}`     | returns the service part         | `{{metric.service}}`             | `compute`                                         |
| `{{metric.label.xxx}}`   | returns the metric label value   | `{{metric.label.instance_name}}` | `grafana-1-prod`                                  |
| `{{resource.label.xxx}}` | returns the resource label value | `{{resource.label.zone}}`        | `us-east1-b`                                      |

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here is a provisioning example using the JWT (Service Account key file) authentication type.

```yaml
apiVersion: 1

datasources:
  - name: Google Cloud Monitoring
    type: stackdriver
    access: proxy
    jsonData:
      tokenUri: https://oauth2.googleapis.com/token
      clientEmail: stackdriver@myproject.iam.gserviceaccount.com
      authenticationType: jwt
      defaultProject: my-project-name
    secureJsonData:
      privateKey: |
        -----BEGIN PRIVATE KEY-----
        POSEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCb1u1Srw8ICYHS
        ...
        yA+23427282348234=
        -----END PRIVATE KEY-----
```

Here is a provisioning example using GCE Default Service Account authentication.

```yaml
apiVersion: 1

datasources:
  - name: Google Cloud Monitoring
    type: stackdriver
    access: proxy
    jsonData:
      authenticationType: gce
```

## Deep linking from Grafana panels to the Metrics Explorer in Google Cloud Console

Only available in Grafana v7.1+.

{{< docs-imagebox img="/img/docs/v71/cloudmonitoring_deep_linking.png" max-width="500px" class="docs-image--right" caption="Google Cloud Monitoring deep linking" >}}

> **Note:** This feature is only available for Metric queries.

Click on a time series in the panel to see a context menu with a link to View in Metrics Explorer in Google Cloud Console. Clicking that link opens the Metrics Explorer in the Google Cloud Console and runs the query from the Grafana panel there.
The link navigates the user first to the Google Account Chooser and after successfully selecting an account, the user is redirected to the Metrics Explorer. The provided link is valid for any account, but it only displays the query if your account has access to the GCP project specified in the query.
