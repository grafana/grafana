---
Feedback Link: https://github.com/grafana/tutorials/issues/new
authors:
  - antonio-calero-merello
categories:
  - alerting
description: Get started with Grafana Alerting by creating your first alert in just a few minutes. Learn how to set up an alert, send alert notifications to a public webhook, and generate sample data to observe your alert in action.
id: alerting-get-started
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting II
weight: 50
---

# Get started with Grafana Alerting II




```mermaid
flowchart TB
    R(["Alert rule"]) --- Q["Query"]
    R --- exp["Check threshold"]
    Q --> D[("Database")]
    D --- tsdata("Mobile page views") & tsdata2("Desktop page views")
    exp --- V("desktop > 1200 views")
    V --> I("Alert instance occurrence")
    I --> N(["Alert notification sent"])
    style tsdata2 stroke:#0f0
    style V stroke:#f00
```