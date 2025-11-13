---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Grafana Operator
  - ArgoCD
title: Manage Dashboards with GitOps Using ArgoCD
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/grafana-operator/manage-dashboards-argocd/
---

# Managing Grafana Dashboards with GitOps Using ArgoCD

This guide will walk you through setting up a continuous deployment pipeline using ArgoCD to synchronize your Grafana dashboards with a Git repository. We'll use the Grafana Dashboard Custom Resource provided by the Grafana Operator to manage dashboard configurations declaratively.

## Prerequisites

- An existing Grafana Cloud stack
- A Kubernetes cluster with Grafana Operator installed, as shown in [Grafana Operator Installation](/docs/grafana-cloud/as-code/infrastructure-as-code/grafana-operator/#installing-the-grafana-operator).
- ArgoCD installed on your Kubernetes cluster. Refer the [Installation Guide](https://argo-cd.readthedocs.io/en/stable/getting_started/).
- Git repository to store your dashboard configurations.

## Set Up Your Git Repository

Within the repository, create a directory structure to organize your grafana and dashboard configurations. For this tutorial, lets create a folder named `grafana`.

## Grafana Operator Setup

The Grafana Operator allows us to authenticate with the Grafana instance using the Grafana Custom Resource (CR).

1. **Create the Grafana API Token Secret:**

Store the Grafana API Token in a secret with the following content in a file named `grafana-token.yml` in the `grafana` folder in your Git repo:

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

Set up connection to your Grafana Cloud instance by creating a file named `grafana-cloud.yml` in the `grafana` folder in your Git repo with the following contents:

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

## Add Dashboards to a Git repository

In your `grafana` directory, Create a sub-folder called `dashboards`. For this tutorial, we will create 3 seperate dashboards.

1. Under `dashboards` folder, Create a file named `simple-dashboard.yaml` with the following content for the first dashboard:

   ```yaml
   apiVersion: grafana.integreatly.org/v1beta1
   kind: GrafanaDashboard
   metadata:
     name: grafanadashboard-sample
     namespace: <grafana-operator-namespace>
   spec:
     resyncPeriod: 30s
     instanceSelector:
       matchLabels:
         dashboards: <Grafana-cloud-stack-name>
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

   Replace the following field values:
   - `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
   - `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

1. Under `dashboards` folder, Create a file named `dashboard-from-cm.yaml` with the following content for the second dashboard:

   ```yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: dashboard-definition
     namespace: <grafana-operator-namespace>
   spec:
     resyncPeriod: 30s
     instanceSelector:
       matchLabels:
         dashboards: <Grafana-cloud-stack-name>
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
     namespace: <grafana-operator-namespace>
   spec:
     instanceSelector:
       matchLabels:
         dashboards: <Grafana-cloud-stack-name>
     configMapRef:
       name: dashboard-definition
       key: json
   ```

   Replace the following field values:
   - `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
   - `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

1. Under `dashboards` folder, Create a file named `dashboard-from-id.yaml` with the following content for the third dashboard:

   ```yaml
   apiVersion: grafana.integreatly.org/v1beta1
   kind: GrafanaDashboard
   metadata:
     name: node-exporter-latest
     namespace: <grafana-operator-namespace>
   spec:
     instanceSelector:
       matchLabels:
         dashboards: <Grafana-cloud-stack-name>
     grafanaCom:
       id: 1860
   ```

   Replace the following field values:
   - `<Grafana-cloud-stack-name>` with the name of your Grafana Cloud Stack.
   - `<grafana-operator-namespace>` with the namespace where the grafana-operator is deployed in Kubernetes Cluster.

## Configure Argo CD to Sync the Git Repository

Once all changes are committed to Git, Log in to the Argo CD user interface or use the CLI.

2. Create an Argo CD application to manage the synchronization:

   **Using UI**:
   - Navigate to 'New App' and fill out the form with your Git repository details and the path to your `grafana` folder.
   - Make sure to tick mark directory Recurse.
   - Set the sync policy to `Automatic`.

   **Using CLI**:
   - Prepare an application manifest named `argo-application.yaml` with the configuration pointing to your Git repository:

   ```yaml
   apiVersion: argoproj.io/v1alpha1
   kind: Application
   metadata:
     name: Grafana
     namespace: <argocd-namespace>
   spec:
     destination:
       name: ''
       namespace: ''
       server: 'https://kubernetes.default.svc'
     source:
       path: <Path-to-grafana-folder>
       repoURL: '<Git-repo-url>'
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

   Replace the following field values:
   - `<Git-repo-url>` with the URL of your GIT Repository.
   - `<Path-to-grafana-folder>` with the path to the `grafana` folder.
   - `<argocd-namespace>` with the namespace where ArgoCD is deployed in Kubernetes Cluster.

   - Create the application in Argo CD:

     ```shell
     kubectl apply -f argo-application.yaml
     ```

## Verify Sync Status in Argo CD

1. Monitor the newly created Argo CD application, ensuring that it successfully syncs your dashboard configuration.

2. Visit the Argo CD dashboard and check the sync status. If it's successful, your Grafana dashboard should be up to date with the configuration from your Git repository.

## Updating the Dashboards

To update an existing dashboard:

1. Make changes to the dashboard JSON configuration in your Git repository.
2. Commit and push the changes.
3. Argo CD will detect the update and synchronize the changes to your Cutom Resource.
4. Grafana Operator will then sync changes to the Grafana Instance.

## Validating the Grafana Dashboard Update

Log in to your Grafana dashboard and confirm that the changes have been applied. You should see the dashboard update reflected in the Grafana UI.

## Additional Tips

- You can also install the Grafana Operator's Helm Chart using ArgoCD to manage your setup with GitOps.
- You can follow a similar setup for Grafana Dashboards and Folders.

## Conclusion

You've set up a GitOps workflow to manage Grafana dashboards using Argo CD and the Grafana Operator. Your dashboards are now version-controlled and can be consistently deployed across environments. This approach provides a reliable and auditable way to manage observability dashboards and scale your operations.

To learn more about managing Grafana using Grafana Operator, see the [Grafana Operator documentation](https://grafana.github.io/grafana-operator/docs/).
