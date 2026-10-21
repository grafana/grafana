---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notebooks
weight: 85
description: Create and manage notebooks, a linear, narrative artifact for investigations that include text and panel blocks.
---

# Notebooks

{{< docs/public-preview product="Notebooks" featureFlag="`dashboard.notebooks`" >}}

A notebook is a page of text and panel blocks arranged in sequence.
Text blocks capture notes and context, and panel blocks display query results inline.
It brings Dashboard panels, Explore queries, and Grafana Assistant findings into one editable artifact.
You can add your reasoning alongside these findings, and then share and collaborate on the notebook with your teammates.

Every block is directly editable, and you can rewrite, reorder, remove, or add more context, as needed.

You can use a notebook to explore a question about your data, document an investigation, or prepare a post-incident review.
In addition, a notebook:

- Provides a space to persist what you learned from your Grafana Assistant chats.
- Keeps your notes within Grafana rather than in external tools, like chat apps, wikis, or stand-alone documents.
- Removes the need for incident-specific dashboards that contribute to dashboard sprawl.
- Doesn't require you to declare an incident to be able to generate an investigation artifact, providing a space for pre-escalation work.

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-v13.3.png" max-width="750px" alt="A notebook with an investigation into excessive series" >}}

## When to use notebooks

Dashboards, the Workspace canvas, and notebooks each help you work with your data in a different way.
They differ in design effort, ease of editing, and reuse.

- **Dashboards** are reusable, curated views. Building one while you're still exploring requires design decisions, and adding exploratory work can make the dashboard less curated.
- **The Workspace canvas** is a temporary exploration space. You can explore without design work, but because an agent creates the canvas, you can't edit it, and it doesn't persist.
- **Notebooks** are a scratchpad you can refine. A notebook picks up where the Workspace canvas leaves off. You write and edit it as you explore, then clean it up into a reusable record.

## Manage notebooks

The **Notebooks** page lists all of the notebooks in your organization, along with the following details for each notebook:

- Title
- Author username
- Tags
- Creation date
- Date of last update

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebooks-list-page-v13.3.png" max-width="750px" alt="Notebooks page" >}}

You can search the page by notebook title, and filter by tags or by notebooks you authored.

Each notebook row includes an **Edit** button and a menu where you can access the following actions:

- Copy a shareable link
- Export by copying the raw Markdown
- Export by downloading a .md file
- Export as a PDF
- Delete

You can also access all of these options inside a notebook in the toolbar:

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-toolbar-v13.3.png" max-width="600px" alt="The toolbar in a notebook with the actions menu open" >}}


When you export a notebook, panels render as JSON code blocks, like this:

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

## Add notebooks

To create a notebook from the **Notebooks** page, follow these steps:

1. Navigate to **Notebooks**.
1. Click **+ New notebook**.
1. (Optional) Update the title of the notebook to something descriptive and searchable.
1. (Optional) Add tags to further define the subject of your notebook.
1. Start typing to create a text block or click one of the other options to add:

   - **Heading**: Adds an H3 heading.
   - **Paragraph**: The default. Use this to revert to paragraph text if you've previously selected another option.
   - **Code**: Adds a code block. Select a language, like Go, SQL, or plain text.
   - **Visualization**: Opens the panel query editor with a graph panel below it.

   You can also type a forward slash (`/`) to open a list of block types from which to select.

1. Add as many blocks as you need.

    Each new block is automatically added after the previous one. To add a block above a previous one, click the plus icon at the top-left corner of the block:
    {{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-add-block-above-v13.3.png" max-width="600px" alt="Adding a notebook block above the current block" >}}

1. Reorder, duplicate, and delete blocks as needed:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-block-actions-v13.3.png" max-width="600px" alt="Notebook block with actions menu open" >}}

1. In the toolbar, take the following actions, as needed:

   - Click the undo and redo icons at the top of the notebook to revert or reinstate changes.
   - Change the time range of the notebook.
   - Change the refresh rate of the notebook.

1. When you've finished making changes, click **View** in the toolbar to leave edit mode.

To update the notebook, click **Edit** in the toolbar again.

You don't need to save a notebook because it auto-saves throughout the creation process.

## Create notebooks from Grafana Assistant Workspace

When you complete a chat with the Grafana Assistant in Workspace, notebooks help you pick up where the canvas leaves off.

While you investigate in Workspace, the canvas assembles the work as a temporary collection of questions, panels, and findings.
The Assistant builds the canvas autonomously in **Investigation** mode, or by way of your chat.

When the canvas is worth keeping, you can direct Assistant to create a notebook or click the **Create notebook** option:

{{< figure src="/media/docs/grafana/dashboards/screenshot-notebook-in-workspace-v13.3.png" max-width="750px" alt="Canvas with the option to create a notebook" >}}

## Notebooks and incidents

Many investigations never become incidents, but the pre-escalation work often includes important signals, and notebooks let you keep that.
Additionally, they provide context you can return to the next time something similar happens.
Each investigation in a notebook makes the next one faster.

You can attach a notebook to an existing incident or declare an incident based on your notebook.

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

## Edit notebooks

To edit a notebook, follow these steps:

1. Navigate to **Notebooks**.
1. Click **Edit** on the row of the notebook you want to update.
1. Make any needed changes.

   Note that you might need to expand panel queries to edit them as they might be collapsed, by default.

1. When you've finished updating the notebook, click **View** to leave edit mode.

You don't need to save a notebook because it auto-saves throughout the editing process.
