---
aliases:
  - ../configure-alertmanager/
description: Configure Alertmanager
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - external Alertmanager
title: Add an external Alertmanager
weight: 100
---

# Add an external Alertmanager

Set up Grafana to use an external Alertmanager as a single Alertmanager to receive all of your alerts. This external Alertmanager can then be configured and administered from within Grafana itself.

Once you have added the Alertmanager, you can use the Grafana Alerting UI to manage silences, contact points, and notification policies. A drop-down option in these pages allows you to switch between alertmanagers.

**Note:**
Starting with Grafana 9.2, the URL configuration of external alertmanagers from the Admin tab on the Alerting page is deprecated. It will be removed in a future release.

External alertmanagers should now be configured as data sources using Grafana Configuration from the main Grafana navigation menu. This enables you to manage the contact points and notification policies of external alertmanagers from within Grafana and also encrypts HTTP basic authentication credentials that were previously visible when configuring external alertmanagers by URL.

To add an external Alertmanager, complete the following steps.

1. Click Configuration and then Data sources.
2. Search for Alertmanager.
3. Choose your Implementation and fill out the fields on the page, as required.

If you are provisioning your data source, set the flag `handleGrafanaManagedAlerts` in the `jsonData` field to `true` to send Grafana-managed alerts to this Alertmanager.

**Note:**
Prometheus, Grafana Mimir, and Cortex implementations of Alertmanager are supported. For Prometheus, contact points and notification policies are read-only in the Grafana Alerting UI.

4. Click Save & test.
