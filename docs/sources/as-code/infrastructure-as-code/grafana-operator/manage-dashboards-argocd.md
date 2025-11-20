---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Grafana Operator
  - ArgoCD
title: Manage dashboards with GitOps using ArgoCD
menuTitle: Manage dashboards with ArgoCD
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/grafana-operator/manage-dashboards-argocd/
---

# Manage Grafana dashboards with GitOps using ArgoCD

This guide shows you how to set up a continuous deployment pipeline using ArgoCD to synchronize your Grafana dashboards with a Git repository. You'll use the Grafana Dashboard Custom Resource provided by the Grafana Operator to manage dashboard configurations declaratively.

## Prerequisites

Before you begin, make sure you have the following:

- An existing Grafana Cloud stack
- A Kubernetes cluster with Grafana Operator installed, as shown in [Grafana Operator Installation](/docs/grafana-cloud/as-code/infrastructure-as-code/grafana-operator/#installing-the-grafana-operator)
- ArgoCD installed on your Kubernetes cluster. Refer to the [ArgoCD Installation Guide](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- A Git repository to store your dashboard configurations

## Set up your Git repository

Create a directory structure in your repository to organize your Grafana and dashboard configurations. For this tutorial, create a folder named `grafana`.

## Set up the Grafana Operator

The Grafana Operator allows you to authenticate with the Grafana instance using the Grafana Custom Resource (CR).

### Create the Grafana API Token Secret

Store the Grafana API Token in a secret. Create a file named `grafana-token.yml` in the `grafana` folder in your Git repository:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-cloud-credentials
  namespace: '<GRAFANA_OPERATOR_NAMESPACE>'
stringData:
  GRAFANA_CLOUD_INSTANCE_TOKEN: '<GRAFANA_API_KEY>'
type: Opaque
```

Replace the placeholders with your values:

- _`<GRAFANA_API_KEY>`_: API key from your Grafana instance. To create an API key, refer to [Grafana API Key Documentation](/docs/grafana/latest/administration/api-keys/)
- _`<GRAFANA_OPERATOR_NAMESPACE>`_: Namespace where the `grafana-operator` is deployed in your Kubernetes cluster

### Configure the Grafana Custom Resource

Set up the connection to your Grafana Cloud instance. Create a file named `grafana-cloud.yml` in the `grafana` folder in your Git repository:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: Grafana
metadata:
  name: '<GRAFANA_CLOUD_STACK_NAME>'
  namespace: '<GRAFANA_OPERATOR_NAMESPACE>'
  labels:
    dashboards: '<GRAFANA_CLOUD_STACK_NAME>'
spec:
  external:
    url: https://<GRAFANA_CLOUD_STACK_NAME>.grafana.net/
    apiKey:
      name: grafana-cloud-credentials
      key: GRAFANA_CLOUD_INSTANCE_TOKEN
```

Replace the placeholders with your values:

- _`<GRAFANA_CLOUD_STACK_NAME>`_: Name of your Grafana Cloud Stack
- _`<GRAFANA_OPERATOR_NAMESPACE>`_: Namespace where the `grafana-operator` is deployed in your Kubernetes cluster

## Add dashboards to your Git repository

In your `grafana` directory, create a sub-folder called `dashboards`.

This guide shows you how to creates three separate dashboards. For all dashboard configurations, replace the placeholders with your values:

- _`<GRAFANA_CLOUD_STACK_NAME>`_: Name of your Grafana Cloud Stack
- _`<GRAFANA_OPERATOR_NAMESPACE>`_: Namespace where the `grafana-operator` is deployed in your Kubernetes cluster

### Create a simple dashboard

Under the `dashboards` folder, create a file named `simple-dashboard.yaml`:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: grafanadashboard-sample
  namespace: '<GRAFANA_OPERATOR_NAMESPACE>'
spec:
  resyncPeriod: 30s
  instanceSelector:
    matchLabels:
      dashboards: '<GRAFANA_CLOUD_STACK_NAME>'
  json: >
    {
    "id": null,
    "title": "Simple Dashboard",
    "tags": [],
    "style": "dark",
    "timezone": "browser",
    "editable": true,
    "hideControls": false,
    "graphTooltip": 1,
    "panels": [],
    "time": {
        "from": "now-6h",
        "to": "now"
    },
    "timepicker": {
        "time_options": [],
        "refresh_intervals": []
    },
    "templating": {
        "list": []
    },
    "annotations": {
        "list": []
    },
    "refresh": "5s",
    "schemaVersion": 17,
    "version": 0,
    "links": []
    }
```

### Create a dashboard from ConfigMap

Under the `dashboards` folder, create a file named `dashboard-from-cm.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-definition
  namespace: <GRAFANA_OPERATOR_NAMESPACE>
data:
  json: >
    {
    "id": null,
    "title": "Simple Dashboard from ConfigMap",
    "tags": [],
    "style": "dark",
    "timezone": "browser",
    "editable": true,
    "hideControls": false,
    "graphTooltip": 1,
    "panels": [],
    "time": {
        "from": "now-6h",
        "to": "now"
    },
    "timepicker": {
        "time_options": [],
        "refresh_intervals": []
    },
    "templating": {
        "list": []
    },
    "annotations": {
        "list": []
    },
    "refresh": "5s",
    "schemaVersion": 17,
    "version": 0,
    "links": []
    }
---
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: grafanadashboard-from-configmap
  namespace: '<GRAFANA_OPERATOR_NAMESPACE>'
spec:
  instanceSelector:
    matchLabels:
      dashboards: '<GRAFANA_CLOUD_STACK_NAME>'
  configMapRef:
    name: dashboard-definition
    key: json
```

### Create a dashboard from Grafana.com

Under the `dashboards` folder, create a file named `dashboard-from-id.yaml`:

```yaml
apiVersion: grafana.integreatly.org/v1beta1
kind: GrafanaDashboard
metadata:
  name: node-exporter-latest
  namespace: '<GRAFANA_OPERATOR_NAMESPACE>'
spec:
  instanceSelector:
    matchLabels:
      dashboards: '<GRAFANA_CLOUD_STACK_NAME>'
  grafanaCom:
    id: 1860
```

## Configure ArgoCD to sync the Git repository

After you commit all changes to Git, log in to the ArgoCD user interface or use the CLI.

### Create an ArgoCD application

**Using the UI:**

1. Navigate to **New App** and complete the form with your Git repository details and the path to your `grafana` folder
2. Enable **Directory Recurse**
3. Set the sync policy to **Automatic**

**Using the CLI:**

Prepare an application manifest named `argo-application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: Grafana
  namespace: '<ARGOCD_NAMESPACE>'
spec:
  destination:
    name: ''
    namespace: ''
    server: 'https://kubernetes.default.svc'
  source:
    path: '<PATH_TO_GRAFANA_FOLDER>'
    repoURL: '<GIT_REPO_URL>'
    targetRevision: HEAD
    directory:
      recurse: true
  sources: []
  project: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 2
    backoff:
      duration: 5s
      maxDuration: 3m0s
      factor: 2
```

Replace the placeholders with your values:

- _`<GIT_REPO_URL>`_: URL of your Git repository
- _`<PATH_TO_GRAFANA_FOLDER>`_: Path to the `grafana` folder in your repository
- _`<ARGOCD_NAMESPACE>`_: Namespace where ArgoCD is deployed in your Kubernetes cluster

Create the application in ArgoCD:

```sh
kubectl apply -f argo-application.yaml
```

## Verify sync status in ArgoCD

1. Monitor the newly created ArgoCD application to ensure it successfully syncs your dashboard configuration
2. Visit the ArgoCD dashboard and check the sync status. If it's successful, your Grafana dashboards should be up to date with the configuration from your Git repository

## Update your dashboards

To update an existing dashboard:

1. Make changes to the dashboard JSON configuration in your Git repository
2. Commit and push the changes
3. ArgoCD detects the update and synchronizes the changes to your Custom Resource
4. Grafana Operator then syncs changes to the Grafana instance

### Validate your dashboard updates

Log in to your Grafana dashboard and confirm that the changes are applied. You should see the dashboard updates reflected in the Grafana UI.

## Next steps

You've successfully set up a GitOps workflow to manage Grafana dashboards using ArgoCD and the Grafana Operator. Your dashboards are now version-controlled and can be consistently deployed across environments. This approach provides a reliable and auditable way to manage observability dashboards and scale your operations.

To learn more about managing Grafana using Grafana Operator:

- [Grafana Operator documentation](https://grafana.github.io/grafana-operator/docs/)
- [Grafana dashboard provisioning](/docs/grafana/latest/administration/provisioning/#dashboards)
- [ArgoCD best practices](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)

### Additional considerations

- You can install the Grafana Operator's Helm Chart using ArgoCD to manage your setup with GitOps
- You can follow a similar setup for Grafana Folders and other resources
