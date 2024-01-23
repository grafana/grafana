---
aliases:
  - ../../installation/helm/
description: Guide for deploying Grafana using Helm Charts
labels:
  products:
    - enterprise
    - oss
menuTitle: Grafana on Helm Charts
title: Deploy Grafana using Helm Charts
weight: 500
---

# Introduction

[Helm](https://helm.sh/) is an open-source command line tool used for managing Kubernetes applications. It is a graduate project in the [CNCF Landscape](https://www.cncf.io/projects/helm/).

{{% admonition type="note" %}}
The Grafana open-source community offers Helm Charts for running it on Kubernetes. Please be aware that the code is provided without any warranties. If you encounter any problems, you can report them to the [Official GitHub repository](https://github.com/grafana/helm-charts/).
{{% /admonition %}}

### Before you begin

To install Grafana using Helm, ensure you have completed the following:
- Install a Kubernetes server on your machine. For information about installing Kubernetes, refer to [Deploy Grafana on Kubernetes](/docs/grafana/latest/setup-grafana/installation/kubernetes/)
- Install the latest stable version of Helm. For information on installing Helm, refer to [Install Helm](https://helm.sh/docs/intro/install/).

# Install Grafana using Helm

When you install Grafana using Helm, you complete the following tasks:
1. Setting up the Grafana Helm repository: Provides a space in which you will install Grafana.
2. Deploy Grafana using Helm: Involves installing Grafana into a namespace.
3. Accessing Grafana: Provides steps to sign in to Grafana

### Setting up the Grafana Helm repository

The first step is to define the URL to the repository so that you download the correct Grafana Helm charts on your machine.

To set up, complete the following steps:

1. To add the Grafana repository, use the following command syntax.
   
   `helm repo add <DESIRED-NAME> <HELM-REPO-URL>`

   The following example adds the `grafana` Helm repository.

   ```
   helm repo add grafana https://grafana.github.io/helm-charts
   ```

2. Run the following command to verify the repository was added.
   
   ```
	 helm repo list
	 ```

   When the repository is successfully added, you should see an output similar to the following:

   ```
   NAME    URL                                  
   grafana https://grafana.github.io/helm-charts
   ```

3. Run the following command to update the repository to download the latest Grafana Helm charts:
   
   ```
   helm repo update
   ```

### Deploy the Grafana Helm charts

Now we have setup the Grafana Helm repository succesfully, we can start to deploy it on our Kubernetes cluster.

When you deploy Grafana Helm charts, use a separate namespace instead of relying on the default namespace. The default namespace might already have other applications running, which can lead to conflicts and other potential issues.
When you create a new namespace in Kubernetes, you can better organize, allocate, and manage cluster resources. For more information about Namespaces, refer to [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/).

1. To create a namespace, run the following command.
   
   ```
   kubectl create namespace monitoring
   ```
   You will see an output similar to this, which means that the namespace has been successfully created:

   ```
   namespace/monitoring created
   ```

2. Search for the official grafana/grafana repository using the command:
   
   `helm search repo <repo-name/package-name>`

   For example, the following command provides a list of the Grafana Helm Charts from which you will install the latest version of the Grafana chart.

   ```
   helm search repo grafana/grafana
   ```

3. Run the following command to deploy the Grafana Helm Chart inside your created namespace.
   
   ```
   helm install my-grafana grafana/grafana --namespace monitoring
   ```

   Where:
   - helm install: installs the chart by deploying it on the Kubernetes cluster
   - my-grafana: the logical chart name that we had given
   - grafana/grafana: the repository and package name to install
   - --namespace: the Kubernetes namespace (for example, `monitoring`) where you want to deploy the chart

4. To verify the deployment status, run the following command and verify that `deployed` appears in the STATUS column:
   
   ```
   helm list -n monitoring
   ```

   You should see an output similar to the following:

   ```
   NAME            NAMESPACE       REVISION        UPDATED                                 STATUS          CHART          APP VERSION
   my-grafana      monitoring      1               2024-01-13 23:06:42.737989554 +0000 UTC deployed        grafana-6.59.0 10.1.0   
   ```

5. To check the overall status of all the objects in the namespace, run the following command:
   
	```
	kubectl get all -n monitoring
	```
   
   If you encounter errors or warnings in the STATUS column, check the logs and refer to Troubleshooting.




