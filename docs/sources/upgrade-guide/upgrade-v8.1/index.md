---
description: Guide for upgrading to Grafana v8.1
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v8.1
menutitle: Upgrade to v8.1
weight: 2800
---

# Upgrade to Grafana v8.1

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Use of unencrypted passwords for data sources no longer supported

As of Grafana v8.1, we no longer support unencrypted storage of passwords and basic auth passwords.

{{% admonition type="note" %}}
Since Grafana v6.2, new or updated data sources store passwords and basic auth passwords encrypted. However, unencrypted passwords and basic auth passwords were also allowed.
{{% /admonition %}}

To migrate to encrypted storage, use a `grafana-cli` command to migrate all of your data sources to use encrypted storage of secrets. See [migrate data and encrypt passwords]({{< relref "../../cli#migrate-data-and-encrypt-passwords" >}}) for further instructions.
