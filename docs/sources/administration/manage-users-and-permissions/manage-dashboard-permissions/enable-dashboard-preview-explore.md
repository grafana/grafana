+++
title = "Enable viewers to preview dashboards and use Explore"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/enable-dashboard-preview-explore.md"]
weight = 30
+++

# Enable viewers to preview dashboards and use Explore

By default, the viewer organization role does not allow viewers to create dashboards or use the Explore feature. However, by modifying a configuration setting you can allow viewers to create and preview (but not save) dashboards, and use the Explore feature.

This modification is useful for public Grafana installations where you want anonymous users to be able to edit panels and queries but not save or create new dashboards.

## Before you begin

- Ensure that you have access to the Grafana server

**To enable viewers to preview dashboards and use Explore**:

1. Open the Grafana configuration file.

   For more information about the Grafana configuration file and its location, refer to [Configuration]({{< relref "../../../administration/configuration">}}).

1. Locate the `viewers_can_edit` parameter.
1. Set the `viewers_can_edit` value to `true`.
1. Save your changes and restart Grafana.
