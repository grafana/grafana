---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: 'Add an alertmanager data source'
---

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Alertmanager` in the search bar.
1. Click **Alertmanager**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

   | Name                            | Description                                                                                                                                                                                 |
   | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **Name**                        | Sets the name you use to refer to the data source                                                                                                                                           |
   | **Default**                     | Sets whether the data source is pre-selected for new panels and queries                                                                                                                     |
   | **Alertmanager Implementation** | Alertmanager implementation. **Mimir**, **Cortex,** and **Prometheus** are supported                                                                                                        |
   | **Receive Grafana Alerts**      | When enabled, the Alertmanager can receive Grafana-managed alerts. **Important:** This works only if receiving alerts is enabled for the Alertmanager in the Grafana Alerting Settings page |
   | **HTTP URL**                    | Sets the HTTP protocol, IP, and port of your Alertmanager instance, such as `https://alertmanager.example.org:9093`                                                                         |
   | **Access**                      | Only **Server** access mode is functional                                                                                                                                                   |
