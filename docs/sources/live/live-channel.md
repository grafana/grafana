---
description: Grafana Live channel guide
keywords:
  - Grafana
  - live
  - guide
  - channel
title: Live Channel
weight: 110
---

# Grafana Live Channel guide

Grafana Live is a PUB/SUB server, clients subscribe to channels to receive real-time updates published to those channels.

## Channel structure

Channel is a string identifier. In Grafana channel consists of 3 parts delimited by `/`:

- Scope
- Namespace
- Path

For example, the channel `grafana/dashboard/xyz` has the scope `grafana`, namespace `dashboard`, and path `xyz`.

Scope, namespace and path can only have ASCII alphanumeric symbols (A-Z, a-z, 0-9), `_` (underscore) and `-` (dash) at the moment. The path part can additionally have `/`, `.` and `=` symbols. The meaning of scope, namespace and path is context-specific.

The maximum length of a channel is 160 symbols.

Scope determines the purpose of a channel in Grafana. For example, for data source plugin channels Grafana uses `ds` scope. For built-in features like dashboard edit notifications Grafana uses `grafana` scope.

Namespace has a different meaning depending on scope. For example, for `grafana` scope this could be a name of built-in real-time feature like `dashboard` (i.e. dashboards events).

The path, which is the final part of a channel, usually contains the identifier of some concrete resource such as the ID of a dashboard that a user is currently looking at. But a path can be anything.

Channels are lightweight and ephemeral - they are created automatically on user subscription and removed as soon as last user left a channel.

## Data format

All data travelling over Live channels must be JSON-encoded.
