---
aliases:
  - /docs/grafana/latest/enterprise/access-control/rbac-provisioning/
  - /docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-provisioning/
description: Learn about RBAC provisioning
menuTitle: RBAC provisioning
title: RBAC provisioning
weight: 60
---

# Provision RBAC resources

Role-based access control provisioning provides a way to manage your access control setup without having to make manual changes through the UI or APIs.
You can provision custom roles as well as role assignments.

There are two options to choose from:

1. Provision your RBAC setup using Terraform.

1. Use Grafana file provisioning to provision your RBAC setup through yaml configuration files.

**Note:**

Currently, provisioning for Grafana Alerting supports alert rules, contact points, mute timings, and templates. Provisioned alerting resources can only be edited in the source that created them and not from within Grafana or any other source. For example, if you provision your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

**Useful Links:**

[Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)

[Grafana Cloud provisioning](https://grafana.com/docs/grafana-cloud/infrastructure-as-code/terraform/)

// TODO update the link
[Grafana RBAC provisioning API](https://grafana.com/docs/grafana/latest/developers/http_api/rbac_provisioning)
