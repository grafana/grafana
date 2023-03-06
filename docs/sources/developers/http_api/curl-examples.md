---
aliases:
  - ../../http_api/curl-examples/
canonical: /docs/grafana/latest/developers/http_api/curl-examples/
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

Here's a cURL command that works for getting the home dashboard when you are running Grafana locally with [basic authentication]({{< relref "../../setup-grafana/configure-security/configure-authentication/#basic-auth" >}}) enabled using the default admin credentials:

```
curl http://admin:admin@localhost:3000/api/search
```

To pass a username and password with [HTTP basic authorization]({{< relref "../../administration/roles-and-permissions/access-control/manage-rbac-roles/" >}}), encode them as base64.
You can't use authorization tokens in the request.

For example, to [list permissions associated with roles]({{< relref "../../administration/roles-and-permissions/access-control/manage-rbac-roles/" >}}) given a username of `user` and password of `password`, use:

```
curl --location '<grafana_url>/api/access-control/builtin-roles' --user 'user:password'
```
