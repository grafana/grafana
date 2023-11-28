---
headless: true
labels:
  products:
    - enterprise
    - oss
title: Upgrade guide introduction
---

We recommend that you upgrade Grafana often to stay current with the latest fixes and enhancements.
Because Grafana upgrades are backward compatible, the upgrade process is straightforward, and dashboards and graphs will not change.

In addition to common tasks you should complete for all versions of Grafana, there might be additional upgrade tasks to complete for a version.

{{% admonition type="note" %}}
There might be breaking changes in some releases. We outline these changes in the [What's New ]({{< relref "../../whatsnew/" >}}) document for most releases or a separate [Breaking changes]({{< relref "../../breaking-changes/" >}}) document for releases with many breaking changes.
{{% /admonition %}}

For versions of Grafana prior to v9.2, we published additional information in the [Release Notes]({{< relref "../../release-notes/" >}}).

When available, we list all changes with links to pull requests or issues in the [Changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md).

{{% admonition type="note" %}}
When possible, we recommend that you test the Grafana upgrade process in a test or development environment.
{{% /admonition %}}
