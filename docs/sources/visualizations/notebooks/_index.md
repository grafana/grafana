---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notebooks
weight: 85
description: Combine notes, queries, and visualizations in Grafana notebooks to investigate problems, document findings, and share supporting data with your team.
---

# Notebooks

{{< docs/public-preview product="Notebooks" featureFlag="`dashboard.notebooks`" >}}

Notebooks combine notes, queries, and visualizations in a single document in Grafana.
Use them to investigate a problem, explain what you found, and share the supporting data with your team.

You can start a notebook yourself, add panels from dashboards or queries from Explore, or create one with Grafana Assistant.
Edit queries and visualizations alongside your notes, and reorder blocks as your investigation develops.

Notebooks are useful for troubleshooting, investigation handoffs, and post-incident reviews.
You don't need to declare an incident or use Grafana Assistant to create one.

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-v13.3.png" max-width="750px" alt="A notebook with an investigation into excessive series" >}}

## When to use notebooks

Use dashboards for ongoing monitoring and reusable views of your systems.
Use notebooks to work through a question and keep the queries, findings, and reasoning together.

For example, you can compare signals from several data sources, explain why a particular result matters, and share the notebook with someone continuing the investigation.
Grafana Assistant can also create a notebook from its findings in Workspace, which you can then continue editing yourself.

## Manage notebooks

The **Notebooks** page lists all of the notebooks in your organization, along with the following details for each notebook:

- Title
- Author username
- Tags
- Creation date
- Date of last update

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebooks-list-page-v13.3.png" max-width="750px" alt="Notebooks page" >}}

You can search the page by notebook title, and filter by tags or by notebooks you authored.

Depending on your permissions, each notebook row includes an **Edit** button and a menu with the following actions:

- Copy a shareable link
- Export by copying the raw Markdown
- Export by downloading a .md file
- Export as a PDF, when a compatible image renderer is available
- Delete

You can also access all of these options inside a notebook in the toolbar:

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-toolbar-v13.3.png" max-width="600px" alt="The toolbar in a notebook with the actions menu open" >}}

Sharing a notebook link doesn't grant access to the notebook or its data sources.
Recipients need permission to view the notebook and query the data sources used by its panels.

When you copy or download a notebook as Markdown, panel queries appear as JSON code blocks rather than rendered visualizations, like this:

```json
[
  {
    "refId": "A",
    "datasource": "grafanacloud-usage",
    "type": "prometheus",
    "query": {
      "expr": "grafanacloud_org_metrics_billable_series"
    }
  }
]
```

PDF exports retain the rendered visualizations.

## Add notebooks

You need permission to create notebooks and access to the data sources you want to query.

To create a notebook from the **Notebooks** page, follow these steps:

1. Navigate to **Notebooks**.
1. Click **New notebook**.
1. (Optional) Update the title of the notebook to something descriptive and searchable.
1. (Optional) Add tags to further define the subject of your notebook.
1. Start typing to create a text block or click one of the buttons below the block to add one of the following options:
   - **Heading**: Adds an H1 heading.
   - **Paragraph**: Adds a text block that you can format with Markdown.
   - **Code**: Adds a code block. Select a language, like Go, SQL, or plain text.
   - **Visualization**: Adds a visualization with its query editor below it.

   You can also type a forward slash (`/`) to open a list of block types from which to select.

1. Add as many blocks as you need.

   Each new block is automatically added after the previous one. To add a block above a previous one, click the plus icon at the top-left corner of the block:
   {{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-add-block-above-v13.3.png" max-width="600px" alt="Adding a notebook block above the current block" >}}

1. Drag the handle on the left of a block to reorder it. Use the **Block actions** menu at the top right to duplicate or delete it:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-block-actions-v13.3.png" max-width="600px" alt="Notebook block with actions menu open" >}}

1. In the toolbar, take the following actions, as needed:
   - Click the undo and redo icons at the top of the notebook to revert or reinstate changes.
   - Change the time range of the notebook.
   - Change the refresh rate of the notebook.

1. When you've finished making changes, click **View** in the toolbar to leave edit mode.

You can also create a notebook from Grafana's **New** menu or by searching for **New notebook** in the command palette.

Notebooks save your changes automatically.

## Edit notebooks

To update an existing notebook, follow these steps:

1. Navigate to **Notebooks**.
1. Click **Edit** on the row of the notebook you want to update, or open the notebook and click **Edit** in its toolbar.
1. Update the text, code, or visualizations as needed.
1. Click **View** to leave edit mode.

## Work with visualizations

Visualization blocks display query results within your notebook.
In edit mode, hover over a visualization or use keyboard navigation to reveal its controls.
You can edit its title and queries, choose a suggested visualization, or give the panel its own time range.

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-visualization-editing-v13.3.png" max-width="750px" alt="Notebook in edit mode with a panel title, visualization controls, a locked time range, and query controls below the chart" >}}

### Add or edit a panel title

Click **Add title** if the panel has no title, or click the pencil icon next to an existing title.
Enter a title and press **Enter** to finish, or press **Escape** to cancel.

### Edit queries

Click **Edit query** in the panel controls to open the query editor below the visualization.
Expand a query row if it's collapsed, select a data source, and edit the query.
Click **Run query** to update the results, or **Add query** to include another query in the panel.

Click **Hide query editor** to hide the editor without removing the queries or the visualization.
Existing panels start with their query editor hidden when you open a notebook in edit mode.

### Change the visualization

After running a query, click **Change visualization** and select one of the suggestions.
Suggestions depend on the data returned by the panel's queries.

Title, query, and visualization editing aren't available for linked library panels in a notebook.

### Set a panel time range

Panels use the notebook's time range unless you set a separate range for a panel.
Use a panel time lock to keep its range independent when you change the notebook's time range.

To set a panel time range, follow these steps:

1. In edit mode, click the clock icon in the panel controls, labeled **Lock panel time range**.
1. Select a relative range, or enter an absolute start and end time and click **Apply time range**.

The locked range appears above the panel and remains visible in view mode.
To change it, return to edit mode and click the locked range.
Click **Remove time lock** to make the panel follow the notebook's time range again.

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-panel-time-range-v13.3.png" max-width="750px" alt="Panel time picker with relative ranges, absolute start and end fields, and the option to remove the time lock" >}}

A relative range, such as **Last 30 minutes**, remains relative to the current time.
To preserve a specific investigation window, use an absolute start and end time.
Locking a time range doesn't save a snapshot of the query results.

### Continue in Explore

Click **Open in Explore** to open the panel's queries and time range in a new tab.
This option is also available in view mode for panels that support Explore.
Changes you make in Explore don't update the notebook automatically.

Use the notebook's undo and redo controls to revert or reinstate panel title, query, visualization, and time-lock changes.

## Add panels from dashboards or Explore

You can bring an existing dashboard panel or an Explore query into a notebook without recreating it.

1. Open a dashboard panel's menu and select **Add to notebook**, or select **Add to notebook** from the **Add** menu in Explore.
1. In the dialog, choose an existing notebook or create a new notebook.
1. Click **Add to notebook**.

You can then open the notebook to add notes or continue editing the visualization.
Adding a dashboard panel to a notebook doesn't change the source dashboard.

## Create notebooks from Grafana Assistant Workspace

In Grafana Assistant Workspace, you can turn investigation findings into a notebook to continue editing and share with your team.

While you investigate in Workspace, the canvas assembles the work as a temporary collection of questions, panels, and findings.
The Assistant builds the canvas autonomously in **Investigation** mode, or by way of your chat.

As you work, you can add the content of a message, such as text or a visualization, from your Assistant conversation to a notebook by clicking the **Add to notebook** icon.
To create a notebook from the entire canvas, ask Assistant to create one or click **Create notebook**:

{{< figure src="/media/docs/grafana/dashboards/screenshot-workspace-notebook-v13.3.png" max-width="750px" alt="Canvas with the option to create a notebook" >}}

## Notebooks and incidents

Notebooks can provide context for incident response, even if you started investigating before declaring an incident.
With Grafana IRM available, you can attach a notebook to an existing incident or declare an incident based on your notebook.

### Attach notebooks to incidents

To attach a notebook to an existing incident, follow these steps:

1. Navigate to **Notebooks**.
1. Open the notebook you want to attach.
1. Click the menu in the toolbar.
1. Select **IRM > Attach to incident**.
1. In the dialog box that opens, select the incident to which you want to attach the notebook.
1. (Optional) Add a caption to provide context.
1. Click **Attach**.

### Declare incidents from notebooks

To declare an incident from a notebook, follow these steps:

1. Navigate to **Notebooks**.
1. Open the notebook you want to use.
1. Click the menu in the toolbar.
1. Select **IRM > Declare incident**.
1. In the dialog box that opens, complete the incident form.
1. Click **Declare incident**.

   This opens the incident you've just created in **IRM > Incidents**.

1. Add any other needed context to the incident.
