---
description: Manage built-in role assignments
keywords:
  - grafana
  - fine-grained-access-control
  - roles
  - permissions
  - fine-grained-access-control-usage
  - enterprise
title: Manage built-in role assignments
weight: 210
---

# Built-in role assignments

To control what your users can access or not, you can assign or unassign [Custom roles]({{< ref "#custom-roles" >}}) or [Fixed roles]({{< ref "#fixed-roles" >}}) to the existing [Organization roles]({{< relref "../../../permissions/organization_roles.md" >}}) or to [Grafana Server Admin]({{< relref "../../../permissions/_index.md#grafana-server-admin-role" >}}) role.
These assignments are called built-in role assignments.

During startup, Grafana will create default assignments for you. When you make any changes to the built-on role assignments, Grafana will take them into account and won’t overwrite during next start.

For more information, refer to [Fine-grained access control references]({{< relref "../fine-grained-access-control-references.md#default-built-in-role-assignments" >}}).

# Manage built-in role assignments

You can create or remove built-in role assignments using [Fine-grained access control API]({{< relref "../../../http_api/access_control.md#create-and-remove-built-in-role-assignments" >}}) or using [Grafana Provisioning]({{< relref "../provisioning.md#manage-default-built-in-role-assignments" >}}).
