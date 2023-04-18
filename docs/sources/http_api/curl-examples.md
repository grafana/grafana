---
description: cURL examples
keywords:
  - grafana
  - http
  - documentation
  - api
  - curl
title: cURL examples
---

# cURL examples

This page provides examples of calls to the Grafana API using cURL.

The most basic example for a dashboard for which there is no authentication. You can test the following on your local machine, assuming a default installation and anonymous access enabled, required:

```
curl http://localhost:3000/api/search
```

Here’s a cURL command that works for getting the home dashboard when you are running Grafana locally with [basic authentication]({{< relref "../auth/#basic-auth" >}}) enabled using the default admin credentials:

```
curl http://admin:admin@localhost:3000/api/search
```
