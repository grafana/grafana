+++
title = "Using Stackdriver in Grafana"
description = "Guide for using Stackdriver in Grafana"
keywords = ["grafana", "stackdriver", "google", "guide"]
type = "docs"
aliases = ["/datasources/stackdriver"]
[menu.docs]
name = "Stackdriver"
parent = "datasources"
weight = 11
+++

# Using Google Stackdriver in Grafana

Grafana ships with built-in support for Google Stackdriver. You just have to add it as a datasource and you will be ready to build dashboards for your Stackdriver metrics.

## Adding the data source to Grafana

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Stackdriver` from the *Type* dropdown.
5. Upload or paste in the Service Account Key (JWT) file. See below for steps to create one.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

Name | Description
------------ | -------------
*Name* | The datasource name. This is how you refer to the datasource in panels & queries.
*Default* | Default datasource means that it will be pre-selected for new panels.
*Service Account Key* | Service Account File for a GCP Project. Instructions below on how to create it.

## Authentication

### Service Account Credentials - Private Key File

To authenticate with the Stackdriver API, you need to create a Google Cloud Platform (GCP) Service Account for the Project you want to show data for. A Grafana datasource integrates with one GCP Project. If you want to visualize data from multiple GCP Projects then you need to create one datasource per GCP Project.

#### Enable APIs

The following APIs need to be enabled first:

- [Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com)
- [Cloud Resource Manager API](https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com)

Click on the links above and click the `Enable` button:

![Enable GCP APIs](/img/docs/v54/stackdriver_enable_api.png)

#### Create a GCP Service Account for a Project

1. Navigate to the [APIs & Services Credentials page](https://console.cloud.google.com/apis/credentials).
2. Click on the `Create credentials` dropdown/button and choose the `Service account key` option.

    ![Create service account button](/img/docs/v54/stackdriver_create_service_account_button.png)
3. On the `Create service account key` page, choose key type `JSON`. Then in the `Service Account` dropdown, choose the `New service account` option:

    ![Create service account key](/img/docs/v54/stackdriver_create_service_account_key.png)
4. Some new fields will appear. Fill in a name for the service account in the `Service account name` field and then choose the `Monitoring Viewer` role from the `Role` dropdown:

    ![Choose role](/img/docs/v54/stackdriver_service_account_choose_role.png)
5. Click the Create button. A Json Web Token (JWT) file will be created and downloaded to your computer. Store this file in a secure place as it allows access to your Stackdriver data.
6. Upload it to Grafana on the datasource Configuration page. You can either upload the file or paste in the contents of the file.
     ![Choose role](/img/docs/v54/stackdriver_grafana_upload_key.png)
7. The file contents will be encrypted and saved in the Grafana database. Don't forget to save after uploading the file!
     ![Choose role](/img/docs/v54/stackdriver_grafana_key_uploaded.png)

## Metric Query Editor

Choose a metric from the `Metric` dropdown.

To add a filter, click the plus icon and choose a field to filter by and enter a filter value e.g. `instance_name = grafana-1`

### Aggregation

The aggregation field lets you combine time series based on common statistics. Read more about this option [here](https://cloud.google.com/monitoring/charts/metrics-selector#aggregation-options).

The `Aligner` field allows you to align multiple time series after the same group by time interval. Read more about how it works [here](https://cloud.google.com/monitoring/charts/metrics-selector#alignment).

### Group By

Group by resource or metric labels to reduce the number of time series.

### Alias Patterns

The Alias field allows you to control the format of the metric names in the legend. The default is to show the metric name, labels and the resource. This can be long and hard to read. Using the following patterns in the alias field, you can format the metric name in the legend the way you want it.

Example Pattern: `{{metric.type}} - {{metric.labels.instance_name}}`

Example Result: `compute.googleapis.com/instance/cpu/usage_time - server1-prod`

### Table Format / Raw Data

Change the option `Format As` to `Table` if you want to show raw data in the `Table` panel.

## Templating

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query Variable

If you add a template variable of the type `Query`, this allows you to query Stackdriver for things like metric names and filter keys. The Stackdriver datasource provides the following functions you can use in the `Query` input field:

Name | Description
---- | --------
*metrics(project_id, filter expression)* | Returns a list of metrics matching the filter expression.
*label_values(project_id, path to label name, filter expression)* | Returns a list of label values matching the filter expression.
*groups(project_id)* | Returns a list of groups.

### Using variables in queries

There are two syntaxes:

- `$<varname>`  Example: rate(http_requests_total{job=~"$job"}[5m])
- `[[varname]]` Example: rate(http_requests_total{job=~"[[job]]"}[5m])

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the *Multi-value* or *Include all value* options are enabled, Grafana converts the labels from plain text to a regex compatible string, which means you have to use `=~` instead of `=`.

## Annotations

[Annotations]({{< relref "reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view.

## Configure the Datasource with Provisioning

It's now possible to configure datasources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for datasources on the [provisioning docs page](/administration/provisioning/#datasources)

Here is a provisioning example for this datasource.

```yaml
apiVersion: 1

datasources:
  - name: Stackdriver
    type: stackdriver
    jsonData:
      tokenUri: https://oauth2.googleapis.com/token
      clientEmail: stackdriver@myproject.iam.gserviceaccount.com
    secureJsonData:
      privateKey: "<contents of your Service Account JWT Key file>"
```
