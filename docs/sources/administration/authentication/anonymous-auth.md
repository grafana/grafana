+++
title = "Anonymous Authentication"
description = "Anonymous authentication "
keywords = ["grafana", "configuration", "documentation", "anonymous"]
type = "docs"
[menu.docs]
name = "Anonymous Auth"
identifier = "anonymous-auth"
parent = "authentication"
weight = 4
+++

# Anonymous Authentication

## [auth.anonymous]

### enabled

Set to `true` to enable anonymous access. Defaults to `false`

### org_name

Set the organization name that should be used for anonymous users. If
you change your organization name in the Grafana UI this setting needs
to be updated to match the new name.

### org_role

Specify role for anonymous users. Defaults to `Viewer`, other valid
options are `Editor` and `Admin`.
