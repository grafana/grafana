---
aliases:
  - ../../installation/helm/
description: Guide for deploying Grafana using Helm Charts
labels:
  products:
    - oss
menuTitle: Grafana on Helm Charts
title: Deploy Grafana using Helm Charts
weight: 500
---

# Deploy Grafana using Helm Charts

This topic includes instructions for installing and running Grafana on Kubernetes using Helm Charts.

[Helm](https://helm.sh/) is an open-source command line tool used for managing Kubernetes applications. It is a graduate project in the [CNCF Landscape](https://www.cncf.io/projects/helm/).

{{< admonition type="note" >}}
The Grafana open-source community offers Helm Charts for running it on Kubernetes. Please be aware that the code is provided without any warranties. If you encounter any problems, you can report them to the [Official GitHub repository](https://github.com/grafana/helm-charts/).
{{< /admonition >}}

Watch this video to learn more about installing Grafana using Helm Charts: {{< youtube id="sgYrEleW24E">}}

## Before you begin

To install Grafana using Helm, ensure you have completed the following:

- Install a Kubernetes server on your machine. For information about installing Kubernetes, refer to [Install Kubernetes](https://kubernetes.io/docs/setup/).
- Install the latest stable version of Helm. For information on installing Helm, refer to [Install Helm](https://helm.sh/docs/intro/install/).

## Install Grafana using Helm

When you install Grafana using Helm, you complete the following tasks:

1. Set up the Grafana Helm repository, which provides a space in which you will install Grafana.

1. Deploy Grafana using Helm, which installs Grafana into a namespace.

1. Accessing Grafana, which provides steps to sign into Grafana.

### Set up the Grafana Helm repository

To set up the Grafana Helm repository so that you download the correct Grafana Helm charts on your machine, complete the following steps:

1. To add the Grafana repository, use the following command syntax:

   `helm repo add <DESIRED-NAME> <HELM-REPO-URL>`

   The following example adds the `grafana` Helm repository.

   ```bash
   helm repo add grafana https://grafana.github.io/helm-charts
   ```

1. Run the following command to verify the repository was added:

   ```bash
   helm repo list
   ```

   After you add the repository, you should see an output similar to the following:

   ```bash
   NAME    URL
   grafana https://grafana.github.io/helm-charts
   ```

1. Run the following command to update the repository to download the latest Grafana Helm charts:

   ```bash
   helm repo update
   ```

### Deploy the Grafana Helm charts

After you have set up the Grafana Helm repository, you can start to deploy it on your Kubernetes cluster.

When you deploy Grafana Helm charts, use a separate namespace instead of relying on the default namespace. The default namespace might already have other applications running, which can lead to conflicts and other potential issues.

When you create a new namespace in Kubernetes, you can better organize, allocate, and manage cluster resources. For more information, refer to [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/).

1. To create a namespace, run the following command:

   ```bash
   kubectl create namespace monitoring
   ```

   You will see an output similar to this, which means that the namespace has been successfully created:

   ```bash
   namespace/monitoring created
   ```

1. Search for the official `grafana/grafana` repository using the command:

   `helm search repo <repo-name/package-name>`

   For example, the following command provides a list of the Grafana Helm Charts from which you will install the latest version of the Grafana chart.

   ```bash
   helm search repo grafana/grafana
   ```

1. Run the following command to deploy the Grafana Helm Chart inside your namespace.

   ```bash
   helm install my-grafana grafana/grafana --namespace monitoring
   ```

   Where:

   - `helm install`: Installs the chart by deploying it on the Kubernetes cluster
   - `my-grafana`: The logical chart name that you provided
   - `grafana/grafana`: The repository and package name to install
   - `--namespace`: The Kubernetes namespace (i.e. `monitoring`) where you want to deploy the chart

1. To verify the deployment status, run the following command and verify that `deployed` appears in the **STATUS** column:

   ```bash
   helm list -n monitoring
   ```

   You should see an output similar to the following:

   ```bash
   NAME            NAMESPACE       REVISION        UPDATED                                 STATUS          CHART          APP VERSION
   my-grafana      monitoring      1               2024-01-13 23:06:42.737989554 +0000 UTC deployed        grafana-6.59.0 10.1.0
   ```

1. To check the overall status of all the objects in the namespace, run the following command:

   ```bash
   kubectl get all -n monitoring
   ```

   If you encounter errors or warnings in the **STATUS** column, check the logs and refer to the Troubleshooting section of this documentation.

### Access Grafana

This section describes the steps you must complete to access Grafana via web browser.

1. Run the following `helm get notes` command:

   ```bash
   helm get notes my-grafana -n monitoring
   ```

   This command will print out the chart notes. You will the output `NOTES` that provide the complete instructions about:

   - How to decode the login password for the Grafana admin account
   - Access Grafana service to the web browser

1. To get the Grafana admin password, run the command as follows:

   ```bash
   kubectl get secret --namespace monitoring my-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
   ```

   It will give you a decoded `base64` string output which is the password for the admin account.

1. Save the decoded password to a file on your machine.

1. To access Grafana service on the web browser, run the following command:

   ```bash
   export POD_NAME=$(kubectl get pods --namespace monitoring -l "app.kubernetes.io/name=grafana,app.kubernetes.io/instance=my-grafana" -o jsonpath="{.items[0].metadata.name}")
   ```

   The above command will export a shell variable named `POD_NAME` that will save the complete name of the pod which got deployed.

1. Run the following port forwarding command to direct the Grafana pod to listen to port `3000`:

   ```bash
   kubectl --namespace monitoring port-forward $POD_NAME 3000
   ```

   For more information about port-forwarding, refer to [Use Port Forwarding to Access Applications in a Cluster](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/).

1. Navigate to `127.0.0.1:3000` in your browser.

1. The Grafana sign-in page appears.

1. To sign in, enter `admin` for the username.

1. For the password paste it which you have saved to a file after decoding it earlier.

## Customize Grafana default configuration

Helm is a popular package manager for Kubernetes. It bundles Kubernetes resource manifests to be re-used across different environments. These manifests are written in a templating language, allowing you to provide configuration values via `values.yaml` file, or in-line using Helm, to replace the placeholders in the manifest where these configurations should reside.

The `values.yaml` file allows you to customize the chart's configuration by specifying values for various parameters such as image versions, resource limits, service configurations, etc.

By modifying the values in the `values.yaml` file, you can tailor the deployment of a Helm chart to your specific requirements by using the helm install or upgrade commands. For more information about configuring Helm, refer to [Values Files](https://helm.sh/docs/chart_template_guide/values_files/).

### Download the values.yaml file

In order to make any configuration changes, download the `values.yaml` file from the Grafana Helm Charts repository:

https://github.com/grafana/helm-charts/blob/main/charts/grafana/values.yaml

{{< admonition type="note" >}}
Depending on your use case requirements, you can use a single YAML file that contains your configuration changes or you can create multiple YAML files.
{{< /admonition >}}

### Enable persistent storage **(recommended)**

By default, persistent storage is disabled, which means that Grafana uses ephemeral storage, and all data will be stored within the container's file system. This data will be lost if the container is stopped, restarted, or if the container crashes.

It is highly recommended that you enable persistent storage in Grafana Helm charts if you want to ensure that your data persists and is not lost in case of container restarts or failures.

Enabling persistent storage in Grafana Helm charts ensures a reliable solution for running Grafana in production environments.

To enable the persistent storage in the Grafana Helm charts, complete the following steps:

1. Open the `values.yaml` file in your favorite editor.

1. Edit the values and under the section of `persistence`, change the `enable` flag from `false` to `true`

   ```yaml
   .......
   ............
   ......
   persistence:
     type: pvc
     enabled: true
     # storageClassName: default
   .......
   ............
   ......
   ```

1. Run the following `helm upgrade` command by specifying the `values.yaml` file to make the changes take effect:

   ```bash
   helm upgrade my-grafana grafana/grafana -f values.yaml -n monitoring
   ```

The PVC will now store all your data such as dashboards, data sources, and so on.

### Install plugins (e.g. Zabbix app, Clock panel, etc.)

You can install plugins in Grafana from the official and community [plugins page](https://grafana.com/grafana/plugins). These plugins allow you to add new visualization types, data sources, and applications to help you better visualize your data.

Grafana currently supports three types of plugins: panel, data source, and app. For more information on managing plugins, refer to [Plugin Management](https://grafana.com/docs/grafana/latest/administration/plugin-management/).

To install plugins in the Grafana Helm Charts, complete the following steps:

1. Open the `values.yaml` file in your favorite editor.

1. Find the line that says `plugins:` and under that section, define the plugins that you want to install.

   ```yaml
   .......
   ............
   ......
   plugins:
   # here we are installing two plugins, make sure to keep the indentation correct as written here.

   - alexanderzobnin-zabbix-app
   - grafana-clock-panel
   .......
   ............
   ......
   ```

1. Save the changes and use the `helm upgrade` command to get these plugins installed:

   ```bash
   helm upgrade my-grafana grafana/grafana -f values.yaml -n monitoring
   ```

1. Navigate to `127.0.0.1:3000` in your browser.

1. Login with admin credentials when the Grafana sign-in page appears.

1. Navigate to UI -> Administration -> Plugins

1. Search for the above plugins and they should be marked as installed.

### Configure a Private CA (Certificate Authority)

In many enterprise networks, TLS certificates are issued by a private certificate authority and are not trusted by default (using the provided OS trust chain).

If your Grafana instance needs to interact with services exposing certificates issued by these private CAs, then you need to ensure Grafana trusts the root certificate.

You might need to configure this if you:

- have plugins that require connectivity to other self hosted systems. For example, if you've installed the Grafana Enterprise Metrics, Logs, or Traces (GEM, GEL, GET) plugins, and your GEM (or GEL/GET) cluster is using a private certificate.
- want to connect to data sources which are listening on HTTPS with a private certificate.
- are using a backend database for persistence, or caching service that uses private certificates for encryption in transit.

In some cases you can specify a self-signed certificate within Grafana (such as in some data sources), or choose to skip TLS certificate validation (this is not recommended unless absolutely necessary).

A simple solution which should work across your entire instance (plugins, data sources, and backend connections) is to add your self-signed CA certificate to your Kubernetes deployment.

1. Create a ConfigMap containing the certificate, and deploy it to your Kubernetes cluster

   ```yaml
   # grafana-ca-configmap.yaml
   ---
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: grafana-ca-cert
   data:
     ca.pem: |
       -----BEGIN CERTIFICATE-----
       (rest of the CA cert)
       -----END CERTIFICATE-----
   ```

   ```bash
   kubectl apply --filename grafana-ca-configmap.yaml --namespace monitoring
   ```

1. Open the Helm `values.yaml` file in your favorite editor.

1. Find the line that says `extraConfigmapMounts:` and under that section, specify the additional ConfigMap that you want to mount.

   ```yaml
   .......
   ............
   ......
   extraConfigmapMounts:
      - name: ca-certs-configmap
        mountPath: /etc/ssl/certs/ca.pem
        subPath: ca.pem
        configMap: grafana-ca-cert
        readOnly: true
   .......
   ............
   ......
   ```

1. Save the changes and use the `helm upgrade` command to update your Grafana deployment and mount the new ConfigMap:

   ```bash
   helm upgrade my-grafana grafana/grafana --values values.yaml --namespace monitoring
   ```

## Troubleshooting

This section includes troubleshooting tips you might find helpful when deploying Grafana on Kubernetes via Helm.

### Collect logs

It is important to view the Grafana server logs while troubleshooting any issues.

To check the Grafana logs, run the following command:

```bash
# dump Pod logs for a Deployment (single-container case)

kubectl logs --namespace=monitoring deploy/my-grafana
```

If you have multiple containers running in the deployment, run the following command to obtain the logs only for the Grafana deployment:

```bash
# dump Pod logs for a Deployment (multi-container case)

kubectl logs --namespace=monitoring deploy/grafana -c my-grafana
```

For more information about accessing Kubernetes application logs, refer to [Pods](https://kubernetes.io/docs/reference/kubectl/cheatsheet/#interacting-with-running-pods) and [Deployments](https://kubernetes.io/docs/reference/kubectl/cheatsheet/#interacting-with-deployments-and-services).

### Increase log levels

By default, the Grafana log level is set to `info`, but you can increase it to `debug` mode to fetch information needed to diagnose and troubleshoot a problem. For more information about Grafana log levels, refer to [Configuring logs](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana#log).

To increase log level to `debug` mode, use the following steps:

1. Open the `values.yaml` file in your favorite editor and search for the string `grafana.ini` and there you will find a section about log mode.

1. Add level: `debug` just below the line `mode: console`

   ```yaml
   # This is the values.yaml file
      .....
   .......
   ....
   grafana.ini:
   paths:
      data: /var/lib/grafana/
      .....
   .......
   ....
      mode: console
      level: debug
   ```

   Make sure to keep the indentation level the same otherwise it will not work.

1. Now to apply this, run the `helm upgrade` command as follows:

   ```bash
   helm upgrade my-grafana grafana/grafana -f values.yaml -n monitoring
   ```

1. To verify it, access the Grafana UI in the browser using the provided `IP:Port`. The Grafana sign-in page appears.

1. To sign in to Grafana, enter `admin` for the username and paste the password which was decoded earlier. Navigate to Server Admin > Settings and then search for log. You should see the level to `debug` mode.

### Reset Grafana admin secrets (login credentials)

By default the login credentials for the super admin account are generated via `secrets`. However, this can be changed easily. To achieve this, use the following steps:

1. Edit the `values.yaml` file and search for the string `adminPassword`. There you can define a new password:

   ```yaml
   # Administrator credentials when not using an existing secret (see below)
   adminUser: admin
   adminPassword: admin
   ```

1. Then use the `helm upgrade` command as follows:

   ```bash
   helm upgrade my-grafana grafana/grafana -f values.yaml -n monitoring
   ```

   This command will now make your super admin login credentials as `admin` for both username and password.

1. To verify it, sign in to Grafana, enter `admin` for both username and password. You should be able to login as super admin.

## Uninstall the Grafana deployment

To uninstall the Grafana deployment, run the command:

`helm uninstall <RELEASE-NAME> <NAMESPACE-NAME>`

```bash
helm uninstall my-grafana -n monitoring
```

This deletes all of the objects from the given namespace monitoring.

If you want to delete the namespace `monitoring`, then run the command:

```bash
kubectl delete namespace monitoring
```
