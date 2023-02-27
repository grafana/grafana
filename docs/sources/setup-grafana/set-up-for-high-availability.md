---
aliases:
  - ../administration/set-up-for-high-availability/
  - ../tutorials/ha_setup/
keywords:
  - grafana
  - tutorials
  - HA
  - high availability
title: Set up Grafana for high availability
weight: 900
---

# Set up Grafana for high availability

Setting up Grafana for high availability is fairly simple. You just need a shared database for storing dashboard, users,
and other persistent data. So the default embedded SQLite database will not work, you will have to switch to MySQL or Postgres.

<div class="text-center">
  <img src="/static/img/docs/tutorials/grafana-high-availability.png"  max-width= "800px" class="center" />
</div>

## Configure multiple servers to use the same database

First, you need to set up MySQL or Postgres on another server and configure Grafana to use that database.
You can find the configuration for doing that in the [[database]]({{< relref "configure-grafana/#database" >}}) section in the Grafana config.
Grafana will now persist all long term data in the database. How to configure the database for high availability is out of scope for this guide. We recommend finding an expert on the database you're using.

## Alerting high availability

Grafana Alerting provides a [high availability mode](https://grafana.com/docs/grafana/latest/alerting/fundamentals/high-availability). It preserves the semantics of legacy dashboard alerting by executing all alerts on every server and by sending notifications only once per alert. Load distribution between servers is not supported at this time.

For instructions on setting up alerting high availability, refer to [Enable alerting high availability](https://grafana.com/docs/grafana/next/alerting/set-up/configure-high-availability/).

**Legacy dashboard alerts**

Legacy Grafana Alerting supports a limited form of high availability. In this model, alert notifications are deduplicated when running multiple servers. This means all alerts are executed on every server, but alert notifications are only sent once per alert. Grafana does not support load distribution between servers.

## Grafana Live

Grafana Live works with limitations in highly available setup. For details, refer to the [Configure Grafana Live HA setup]({{< relref "set-up-grafana-live/#configure-grafana-live-ha-setup" >}}).

## User sessions

Grafana uses auth token strategy with database by default. This means that a load balancer can send a user to any Grafana server without having to log in on each server.
