---
aliases:
  - about-alerting/ # /docs/grafana/<GRAFANA_VERSION>/about-alerting
  - ./unified-alerting/alerting/ # /docs/grafana/<GRAFANA_VERSION>/unified-alerting/alerting/
  - ./alerting/unified-alerting/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/
canonical: https://grafana.com/docs/grafana/latest/alerting/
description: Learn about the key benefits and features of Grafana Alerting
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Grafana Alerting
weight: 114
hero:
  title: Grafana Alerting
  level: 1
  image: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-alerting.svg
  width: 100
  height: 100
  description: Grafana Alerting allows you to learn about problems in your systems moments after they occur.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Introduction
      href: ./fundamentals/
      description: Learn more about the fundamentals and available features that help you create, manage, and respond to alerts; and improve your team’s ability to resolve issues quickly.
      height: 24
    - title: Configure alert rules
      href: ./alerting-rules/
      description: Create, manage, view, and adjust alert rules to alert on your metrics data or log entries from multiple data sources — no matter where your data is stored.
      height: 24
    - title: Configure notifications
      href: ./configure-notifications/
      description: Choose how, when, and where to send your alert notifications.
      height: 24
    - title: Monitor status
      href: ./monitor-status/
      description: Monitor, respond to, and triage issues within your services.
      height: 24
    - title: Additional configuration
      href: ./set-up/
      description: Use advanced configuration options to further tailor your alerting setup. These options can enhance security, scalability, and automation in complex environments.
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Monitor your incoming metrics data or log entries and set up your Grafana Alerting system to watch for specific events or circumstances.

In this way, you eliminate the need for manual monitoring and provide a first line of defense against system outages or changes that could turn into major incidents.

Using Grafana Alerting, you create queries and expressions from multiple data sources — no matter where your data is stored — giving you the flexibility to combine your data and alert on your metrics and logs in new and unique ways. You can then create, manage, and take action on your alerts from a single, consolidated view, and improve your team’s ability to identify and resolve issues quickly.

## Explore

{{< card-grid key="cards" type="simple" >}}
