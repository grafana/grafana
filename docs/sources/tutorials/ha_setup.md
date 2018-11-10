+++
title = "Setup Grafana for High availability"
type = "docs"
keywords = ["grafana", "tutorials", "HA", "high availability"]
[menu.docs]
parent = "tutorials"
weight = 10
+++

# How to setup Grafana for high availability

Setting up Grafana for high availability is fairly simple. It comes down to two things:

  1. Use a shared database for storing dashboard, users, and other persistent data
  2. Decide how to store session data.

<div class="text-center">
  <img src="/img/docs/tutorials/grafana-high-availability.png"  max-width= "800px" class="center"></img>
</div>

## Configure multiple servers to use the same database

First, you need to do is to setup MySQL or Postgres on another server and configure Grafana to use that database.
You can find the configuration for doing that in the [[database]]({{< relref "configuration.md" >}}#database) section in the grafana config.
Grafana will now persist all long term data in the database. How to configure the database for high availability is out of scope for this guide. We recommend finding an expert on for the database you're using.

## User sessions

The second thing to consider is how to deal with user sessions and how to configure your load balancer in front of Grafana.
Grafana supports two ways of storing session data: locally on disk or in a database/cache-server.
If you want to store sessions on disk you can use `sticky sessions` in your load balancer. If you prefer to store session data in a database/cache-server
you can use any stateless routing strategy in your load balancer (ex round robin or least connections).

### Sticky sessions
Using sticky sessions, all traffic for one user will always be sent to the same server. Which means that session related data can be
stored on disk rather than on a shared database. This is the default behavior for Grafana and if only want multiple servers for fail over this is a good solution since it requires the least amount of work.

### Stateless sessions
You can also choose to store session data in a Redis/Memcache/Postgres/MySQL which means that the load balancer can send a user to any Grafana server without having to log in on each server. This requires a little bit more work from the operator but enables you to remove/add grafana servers without impacting the user experience.
If you use MySQL/Postgres for session storage, you first need a table to store the session data in. More details about that in [[sessions]]({{< relref "configuration.md" >}}#session)

For Grafana itself it doesn't really matter if you store the session data on disk or database/redis/memcache. But we recommend using a database/redis/memcache since it makes it easier manage the grafana servers.

## Alerting

Currently alerting supports a limited form of high availability. Since v4.2.0, alert notifications are deduped when running multiple servers. This means all alerts are executed on every server but alert notifications are only sent once per alert. Grafana does not support distributing the alert rule execution between servers. That might be added in the future but right now prefer to keep it simple.
