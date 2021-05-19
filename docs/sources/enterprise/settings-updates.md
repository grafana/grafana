+++
title = "Settings updates at runtime"
description = "Settings updates at runtime"
keywords = ["grafana", "runtime", "settings"]
weight = 500
+++

# Settings updates at runtime

> **Note:** Available in Grafana Enterprise v8.0+.

Settings updates at runtime allows you to update Grafana settings with no need to restart the instance.

Currently, **it only supports updates on the `auth.saml` section.** 

## Update settings via the API

You can update / remove settings through the [Admin API]({{< relref "../http_api/admin.md#update-settings" >}}).

It verifies if the given settings updates (or removals) are allowed and valid, persists them into the database and reload
Grafana services with no need to restart the instance.

## Background job (high availability set-ups)

Grafana Enterprise has a built-in scheduled background job that every minute looks into the database for
settings updates. If so, it reloads the Grafana services affected by the detected changes. 

It is used as the synchronization mechanism in high availability set-ups. So, after you perform some changes through the
HTTP API, then the other instances are synchronized through the database and the background job.
