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

### Setting up the Grafana Helm repository.

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





