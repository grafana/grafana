---
aliases:
  - ../../installation/helm/
description: Guide for deploying Grafana using Helm Charts
labels:
  products:
    - enterprise
    - oss
menuTitle: Running Grafana using Helm
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