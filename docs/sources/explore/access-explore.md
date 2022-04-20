+++
title = "Access Explore"
keywords = ["explore", "loki", "logs"]
weight = 5
+++

# Access Explore

> Refer to [Fine-grained access Control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how you can manage Explore with fine-grained permissions.

Before you can access Explore, you must either have an editor or an administrator role, or the [viewers_can_edit option]({{< relref "../administration/configuration/#viewers_can_edit" >}}) must be enabled. Refer to [About users and permissions]({{< relref "../administration/manage-users-and-permissions/about-users-and-permissions.md" >}}) for more information on what each role has access to.

## Accessing Explore

To access Explore:

1. Click on the Explore icon on the menu bar.

   {{< figure src="/static/img/docs/explore/access-explore-7-4.png" max-width= "650px" caption="Screenshot of the new Explore Icon" >}}

   An empty Explore tab opens.

   To start with an existing query in a panel, choose the Explore option from the Panel menu. This opens an Explore tab populated with the query from the panel, which you can tweak or iterate in the query outside of your dashboard.

{{< figure src="/static/img/docs/explore/panel_dropdown-7-4.png" class="docs-image--no-shadow" max-width= "650px" caption="Screenshot of the new Explore option in the panel menu" >}}

Once you have access to Explore, you can start examining data by [adding queries]({{< relref "add-a-query.md" >}}).
