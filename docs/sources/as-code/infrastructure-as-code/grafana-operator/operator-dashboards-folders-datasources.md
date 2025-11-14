---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Grafana Operator
title: Manage folders, data sources, and dashboards using Grafana Operator
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/grafana-operator/operator-dashboards-folders-datasources/
---

# Creating and managing folders, data sources, and dashboards using the Grafana Operator

Learn how to manage data sources, folders and dashboard, using Grafana Operator.

## Prerequisites

Before you begin, you should have the following available:

- An existing Grafana Cloud stack.
- Grafana Operator Installed in your Cluster, as shown in [Grafana Operator Installation](/docs/grafana-cloud/as-code/infrastructure-as-code/grafana-operator/#installing-the-grafana-operator).

## Grafana Operator Setup

The Grafana Operator allows us to authenticate with the Grafana instance using the Grafana Custom Resource (CR).

1. **Create the Grafana API Token Secret:**

Store the Grafana API Token in a secret with the following content in a file named `grafana-token.yml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-cloud-credentials
  namespace: <grafana-operator-namespace>
stringData:
  GRAFANA_CLOUD_INSTANCE_TOKEN: <Grafana-API-Key>
type: Opaque
```

Replace the following field values:

- `<Grafana-API-Key>` with API key from the Grafana instance. To create an API key, refer [Grafana API Key Documentation](/docs/grafana/latest/administration/api-keys/).
- `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

2. **Configure the Grafana Custom Resource:**

Set up connection to your Grafana Cloud instance by creating a file named `grafana-cloud.yml` with the following contents:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: Grafana
metadata:
  name: <Grafana-cloud-stack-name>
  namespace: <grafana-operator-namespace>
  labels:
    dashboards: <Grafana-cloud-stack-name>
spec:
  external:
    url: https://<Grafana-cloud-stack-name>.grafana.net/
    apiKey:
      name: grafana-cloud-credentials
      key: GRAFANA_CLOUD_INSTANCE_TOKEN
```

Replace the following field values:

- `<Grafana-API-Key>` with API key from the Grafana instance.
- `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
- `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

## Add a data source

The following steps use the Prometheus data source. The required arguments vary depending on the data source you select.

1. **Create the Data Source Configuration:**

Save a new YAML file `datasource.yml` with the following content:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDatasource
metadata:
  name: <data-source-name>
  namespace: <grafana-operator-namespace>
spec:
  instanceSelector:
    matchLabels:
      dashboards: <Grafana-cloud-stack-name>
  allowCrossNamespaceImport: true
  datasource:
    access: proxy
    database: prometheus
    jsonData:
      timeInterval: 5s
      tlsSkipVerify: true
    name: <data-source-name>
    type: prometheus
    url: <data-source-url>
```

Replace the following field values:

- `<data-source-name>` with the name of the data source to be added in Grafana.
- `<data-source-url>` with URL of your data source.
- `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
- `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

## Add a dashboard to a folder

Use the following YAML definition to create a simple dashboard in the Grafana instance under a custom folder. If the folder defined under spec.folder fields doesnt not exist, The operator will create it before placing the dashboard inside the folder.

1. **Prepare the Dashboard Configuration File:**

In `dashboard.yml`, define the dashboard and assign it to a folder:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: <folder-name>
  namespace: <grafana-operator-namespace>
spec:
  instanceSelector:
    matchLabels:
      dashboards: <Grafana-cloud-stack-name>
  folder: "<folder-name>"
  json: >
  {
    "title": "as-code dashboard",
    “uid” : “ascode”
  }
```

Replace the following field values:

- `<folder-name>` with the name of the folder in which you want the Dashboard to be created.
- `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
- `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

## Apply Kubernetes Manifests

In a terminal, run the following commands from the directory where all of the above Kubernetes YAML definitions are located.

1. Create Kubernetes Custom resources for all of the above configurations.

   ```shell
   kubectl apply -f grafana-token.yml grafana-cloud.yml datasource.yml dashboard.yml
   ```

## Validation

Once you apply the configurations, you should be able to verify the following:

- A new data source is visible in Grafana. In the following image a datasource named `InfluxDB` was created.

  ![InfluxDB datasource](/static/img/docs/grafana-cloud/terraform/influxdb_datasource_tf.png)

- A new dashboard and folder in Grafana. In the following image a dashboard named `InfluxDB Cloud Demos` was created inside the `Demos` folder.

  ![InfluxDB dashboard](/static/img/docs/grafana-cloud/grizzly/grizzly-folder-dashboard-datasource.png)

## Conclusion

In this guide, you created a data source, folder, and dashboard using the Grafana Operator.

To learn more about managing Grafana using Grafana Operator, see the [Grafana Operator documentation](https://grafana.github.io/grafana-operator/docs/).
