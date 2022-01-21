+++
title = "Enable viewers to preview dashboards and use Explore"
aliases = ["path here"]
weight = 70
+++

# Enable viewers to preview dashboards and use Explore

By default, the viewer organization role does not allow viewers to create dashboards or use the Explore feature. However, by modifying a configuration setting you can allow viewers to create and preview (but not save) dashboards, and use the Explore feature.

This modification is useful for public Grafana installations where you want anonymous users to be able to edit panels and queries but not save or create new dashboards.

## Before you begin

- Ensure you have organization administrator privileges

**To enable viewers to preview dashboards and use Explore**:

1. Open the Grafana configuration file.

   For more information about the Grafana configuration file and its location, refer to [Configuration]({{< relref "../../administration/configuration">}}).

1. Locate the `viewers_can_edit` parameter.
1. Set the `viewers_can_edit` value to `true`.
1. Save your changes and restart Grafana.
