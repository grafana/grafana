+++
title = "Using Stackdriver in Grafana"
description = "Guide for using Stackdriver in Grafana"
keywords = ["grafana", "stackdriver", "google", "guide"]
type = "docs"
aliases = ["/datasources/stackdriver"]
[menu.docs]
name = "Google Stackdriver"
parent = "datasources"
weight = 4
+++

# Using Google Stackdriver in Grafana

> Available as a beta feature in Grafana v5.3.x and v5.4.x.
> Officially released in Grafana v6.0.0

Grafana ships with built-in support for Google Stackdriver. Just add it as a datasource and you are ready to build dashboards for your Stackdriver metrics.

## Adding the data source to Grafana

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Stackdriver` from the _Type_ dropdown.
5. Upload or paste in the Service Account Key file. See below for steps on how to create a Service Account Key file.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

| Name                  | Description                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| _Name_                | The datasource name. This is how you refer to the datasource in panels & queries.   |
| _Default_             | Default datasource means that it will be pre-selected for new panels.               |
| _Service Account Key_ | Service Account Key File for a GCP Project. Instructions below on how to create it. |

## Authentication

There are two ways to authenticate the Stackdriver plugin - either by uploading a Google JWT file, or by automatically retrieving credentials from Google metadata server. The latter option is only available when running Grafana on GCE virtual machine.

### Using a Google Service Account Key File

To authenticate with the Stackdriver API, you need to create a Google Cloud Platform (GCP) Service Account for the Project you want to show data for. A Grafana datasource integrates with one GCP Project. If you want to visualize data from multiple GCP Projects then you need to create one datasource per GCP Project.

#### Enable APIs

The following APIs need to be enabled first:

* [Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com)
* [Cloud Resource Manager API](https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com)

Click on the links above and click the `Enable` button:

{{< docs-imagebox img="/img/docs/v53/stackdriver_enable_api.png" class="docs-image--no-shadow" caption="Enable GCP APIs" >}}

#### Create a GCP Service Account for a Project

1. Navigate to the [APIs & Services Credentials page](https://console.cloud.google.com/apis/credentials).
2. Click on the `Create credentials` dropdown/button and choose the `Service account key` option.

    {{< docs-imagebox img="/img/docs/v53/stackdriver_create_service_account_button.png" class="docs-image--no-shadow" caption="Create service account button" >}}

3. On the `Create service account key` page, choose key type `JSON`. Then in the `Service Account` dropdown, choose the `New service account` option:

    {{< docs-imagebox img="/img/docs/v53/stackdriver_create_service_account_key.png" class="docs-image--no-shadow" caption="Create service account key" >}}

4. Some new fields will appear. Fill in a name for the service account in the `Service account name` field and then choose the `Monitoring Viewer` role from the `Role` dropdown:

    {{< docs-imagebox img="/img/docs/v53/stackdriver_service_account_choose_role.png" class="docs-image--no-shadow" caption="Choose role" >}}

5. Click the Create button. A JSON key file will be created and downloaded to your computer. Store this file in a secure place as it allows access to your Stackdriver data.
6. Upload it to Grafana on the datasource Configuration page. You can either upload the file or paste in the contents of the file.

    {{< docs-imagebox img="/img/docs/v53/stackdriver_grafana_upload_key.png" class="docs-image--no-shadow" caption="Upload service key file to Grafana" >}}

7. The file contents will be encrypted and saved in the Grafana database. Don't forget to save after uploading the file!

    {{< docs-imagebox img="/img/docs/v53/stackdriver_grafana_key_uploaded.png" class="docs-image--no-shadow" caption="Service key file is uploaded to Grafana" >}}

### Using GCE Default Service Account

If Grafana is running on a Google Compute Engine (GCE) virtual machine, it is possible for Grafana to automatically retrieve default credentials from the metadata server. This has the advantage of not needing to generate a private key file for the service account and also not having to upload the file to Grafana. However for this to work, there are a few preconditions that need to be met.

1. First of all, you need to create a Service Account that can be used by the GCE virtual machine. See detailed instructions on how to do that [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#createanewserviceaccount).
2. Make sure the GCE virtual machine instance is being run as the service account that you just created. See instructions [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#using).
3. Allow access to the `Stackdriver Monitoring API` scope. See instructions [here](changeserviceaccountandscopes).

Read more about creating and enabling service accounts for GCE VM instances [here](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).

## Metric Query Editor

{{< docs-imagebox img="/img/docs/v53/stackdriver_query_editor.png" max-width= "400px" class="docs-image--right" >}}

The Stackdriver query editor allows you to select metrics, group/aggregate by labels and by time, and use filters to specify which time series you want in the results.

Begin by choosing a `Service` and then a metric from the `Metric` dropdown. Use the plus and minus icons in the filter and group by sections to add/remove filters or group by clauses.

Stackdriver metrics can be of different kinds (GAUGE, DELTA, CUMULATIVE) and these kinds have support for different aggregation options (reducers and aligners). The Grafana query editor shows the list of available aggregation methods for a selected metric and sets a default reducer and aligner when you select the metric. Units for the Y-axis are also automatically selected by the query editor.

### Filter

To add a filter, click the plus icon and choose a field to filter by and enter a filter value e.g. `instance_name = grafana-1`. You can remove the filter by clicking on the filter name and select `--remove filter--`.

#### Simple wildcards

When the operator is set to `=` or `!=` it is possible to add wildcards to the filter value field. E.g `us-*` will capture all values that starts with "us-" and `*central-a` will capture all values that ends with "central-a". `*-central-*` captures all values that has the substring of -central-. Simple wildcards are less expensive than regular expressions.

#### Regular expressions

When the operator is set to `=~` or `!=~` it is possible to add regular expressions to the filter value field. E.g `us-central[1-3]-[af]` would match all values that starts with "us-central", is followed by a number in the range of 1 to 3, a dash and then either an "a" or an "f". Leading and trailing slashes are not needed when creating regular expressions.

### Aggregation

The aggregation field lets you combine time series based on common statistics. Read more about this option [here](https://cloud.google.com/monitoring/charts/metrics-selector#aggregation-options).

The `Aligner` field allows you to align multiple time series after the same group by time interval. Read more about how it works [here](https://cloud.google.com/monitoring/charts/metrics-selector#alignment).

#### Alignment Period/Group by Time

The `Alignment Period` groups a metric by time if an aggregation is chosen. The default is to use the GCP Stackdriver default groupings (which allows you to compare graphs in Grafana with graphs in the Stackdriver UI).
The option is called `Stackdriver auto` and the defaults are:

* 1m for time ranges < 23 hours
* 5m for time ranges >= 23 hours and < 6 days
* 1h for time ranges >= 6 days

The other automatic option is `Grafana auto`. This will automatically set the group by time depending on the time range chosen and the width of the graph panel. Read more about the details [here](http://docs.grafana.org/reference/templating/#the-interval-variable).

It is also possible to choose fixed time intervals to group by, like `1h` or `1d`.

### Group By

Group by resource or metric labels to reduce the number of time series and to aggregate the results by a group by. E.g. Group by instance_name to see an aggregated metric for a Compute instance.

### Alias Patterns

The Alias By field allows you to control the format of the legend keys. The default is to show the metric name and labels. This can be long and hard to read. Using the following patterns in the alias field, you can format the legend key the way you want it.

#### Metric Type Patterns

| Alias Pattern        | Description                  | Example Result                                    |
| -------------------- | ---------------------------- | ------------------------------------------------- |
| `{{metric.type}}`    | returns the full Metric Type | `compute.googleapis.com/instance/cpu/utilization` |
| `{{metric.name}}`    | returns the metric name part | `instance/cpu/utilization`                        |
| `{{metric.service}}` | returns the service part     | `compute`                                         |

#### Label Patterns

In the Group By dropdown, you can see a list of metric and resource labels for a metric. These can be included in the legend key using alias patterns.

| Alias Pattern Format     | Description                      | Alias Pattern Example            | Example Result   |
| ------------------------ | -------------------------------- | -------------------------------- | ---------------- |
| `{{metric.label.xxx}}`   | returns the metric label value   | `{{metric.label.instance_name}}` | `grafana-1-prod` |
| `{{resource.label.xxx}}` | returns the resource label value | `{{resource.label.zone}}`        | `us-east1-b`     |

Example Alias By: `{{metric.type}} - {{metric.labels.instance_name}}`

Example Result: `compute.googleapis.com/instance/cpu/usage_time - server1-prod`

It is also possible to resolve the name of the Monitored Resource Type.

| Alias Pattern Format | Description                                     | Example Result |
| -------------------- | ----------------------------------------------- | -------------- |
| `{{resource.type}}`  | returns the name of the monitored resource type | `gce_instance` |

Example Alias By: `{{resource.type}} - {{metric.type}}`

Example Result: `gce_instance - compute.googleapis.com/instance/cpu/usage_time`

## Templating

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query Variable

Variable of the type *Query* allows you to query Stackdriver for various types of data. The Stackdriver data source plugin provides the following `Query Types`.

| Name                | Description                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| *Metric Types*      | Returns a list of metric type names that are available for the specified service.                 |
| *Labels Keys*       | Returns a list of keys for `metric label` and `resource label` in the specified metric.           |
| *Labels Values*     | Returns a list of values for the label in the specified metric.                                   |
| *Resource Types*    | Returns a list of resource types for the the specified metric.                                    |
| *Aggregations*      | Returns a list of aggregations (cross series reducers) for the the specified metric.              |
| *Aligners*          | Returns a list of aligners (per series aligners) for the the specified metric.                    |
| *Alignment periods* | Returns a list of all alignment periods that are available in Stackdriver query editor in Grafana |

### Using variables in queries

There are two syntaxes:

* `$<varname>` Example: `metric.label.$metric_label`
* `[[varname]]` Example: `metric.label.[[metric_label]]`

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the _Multi-value_ or _Include all value_ options are enabled, Grafana converts the labels from plain text to a regex compatible string, which means you have to use `=~` instead of `=`.

## Annotations

{{< docs-imagebox img="/img/docs/v53/stackdriver_annotations_query_editor.png" max-width= "400px" class="docs-image--right" >}}

[Annotations]({{< relref "reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view. Annotation rendering is expensive so it is important to limit the number of rows returned. There is no support for showing Stackdriver annotations and events yet but it works well with [custom metrics](https://cloud.google.com/monitoring/custom-metrics/) in Stackdriver.

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

## Configure the Datasource with Provisioning

It's now possible to configure datasources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for datasources on the [provisioning docs page](/administration/provisioning/#datasources)

Here is a provisioning example using the JWT (Service Account key file) authentication type.

```yaml
apiVersion: 1

datasources:
  - name: Stackdriver
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
  - name: Stackdriver
    type: stackdriver
    access: proxy
    jsonData:
      authenticationType: gce
```
