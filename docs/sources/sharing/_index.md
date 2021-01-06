+++
title = "Sharing"
weight = 4
draft = "true"
+++

# Sharing

Grafana allows you to share dashboards and panels with other users within your organization and in certain situations, publicly on the Web. You can share using:
- A direct link
- A Snapshot
- An embedded link (for panels only)
- An export link (for dashboards only)

You must have an authorized viewer permission to see an image rendered by a direct link.

The same permission is also required to view embedded links unless you have anonymous access permission enabled for the Grafana instance.  You can enable this option by yourself in Grafana OSS. To enable anonymous access on a Grafana Cloud,instance contact Customer Support.

When you share a panel or dashboard as a Snapshot, a snapshot (of the panel or the dashboard at that moment in time) is publicly available on the Web. Anyone with a link to the Snapshot can access it. 

Since snapshots do not need any authorization to view, Grafana strips information related to the account it came from as well as all data that is not relevant from the snapshot.
