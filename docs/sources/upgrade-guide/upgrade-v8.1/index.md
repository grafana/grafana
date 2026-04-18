---
description: Upgrade to Grafana v8.1
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
labels:
  products:
    - enterprise
    - oss
menutitle: Upgrade to v8.1
title: Upgrade to Grafana v8.1
weight: 2800
---

# Upgrade to Grafana v8.1

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Use of unencrypted passwords for data sources no longer supported

As of Grafana v8.1, we no longer support unencrypted storage of passwords and basic auth passwords.

{{< admonition type="note" >}}
Since Grafana v6.2, new or updated data sources store passwords and basic auth passwords encrypted. However, unencrypted passwords and basic auth passwords were also allowed.
{{< /admonition >}}

To migrate to encrypted storage, use a `grafana-cli` command to migrate all of your data sources to use encrypted storage of secrets. See [migrate data and encrypt passwords](../../cli/#migrate-data-and-encrypt-passwords) for further instructions.
