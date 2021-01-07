+++
title = "Sharing"
weight = 110
+++

# Sharing Overview

Grafana allows you to share dashboards and panels in a dashboard with other users within an organization and in certain situations, publicly on the Web. You can share using:
- A direct link
- A Snapshot
- An embedded link (for panels only)
- An export link (for dashboards only)

You must have an authorized viewer permission to see an image rendered by a direct link.

The same permission is also required to view embedded links unless you have anonymous access permission enabled for your Grafana instance. You can enable anonymous access permission by yourself in Grafana OSS. To enable anonymous access on a Grafana Cloud instance, contact your Customer Support.

When you share a panel or dashboard as a Snapshot, a snapshot (of the panel or the dashboard at that moment in time) is publicly available on the Web. Anyone with a link to the Snapshot can access it. Since snapshots do not need any authorization to view, Grafana strips information related to the account it came from, as well as any data that is not relevant from the snapshot.