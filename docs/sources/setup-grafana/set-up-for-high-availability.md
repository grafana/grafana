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

Grafana uses an embedded sqlite3 database to store users, dashboards, and other persistent data by default. For high availability, you must use a shared database to store this data. This shared database can be either MySQL or Postgres.

<div class="text-center">
  <img src="/static/img/docs/tutorials/grafana-high-availability.png"  max-width= "800px" class="center" />
</div>

## Pre-requisite Setup 

In order to proceed with setting up Grafana for high availability you will need to first configure a MySQL or Postgres database. It is recommended that this database be configured to be highly available. Configuring the database itself for high availability is out of scope for this guide, but instructions can be found online for each database.

## Configure multiple Grafana servers to use the same database

Once you have either a Postgres or MySQL database available, you can now configure your multiple Grafana instances to use a shared backend database. Grafana has default and custom configuration files and you can update the database settings by updating your custom configuration file as described in the [[database]]({{< relref "configure-grafana/#database" >}}) section of the Grafana configuration. Once configured to use a shared database, your multiple Grafana instances will now persist all long term data in that database. 

## Alerting high availability

Grafana Alerting provides a [high availability mode](https://grafana.com/docs/grafana/latest/alerting/fundamentals/high-availability). It preserves the semantics of legacy dashboard alerting by executing all alerts on every server and by sending notifications only once per alert. Load distribution between servers is not supported at this time.

For instructions on setting up alerting high availability, refer to [Enable alerting high availability](https://grafana.com/docs/grafana/next/alerting/set-up/configure-high-availability/).

**Legacy dashboard alerts**

Legacy Grafana Alerting supports a limited form of high availability. In this model, alert notifications are deduplicated when running multiple servers. This means all alerts are executed on every server, but alert notifications are only sent once per alert. Grafana does not support load distribution between servers.

## Grafana Live

Grafana Live works with limitations in highly available setup. For details, refer to the [Configure Grafana Live HA setup]({{< relref "set-up-grafana-live/#configure-grafana-live-ha-setup" >}}).

## User sessions

Grafana uses auth token strategy with database by default. This means that a load balancer can send a user to any Grafana server without having to log in on each server.
