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

A notebook is a linear page of blocks.
Text blocks hold narrative and notes, and panel blocks hold queries that render inline.
The sequence mirrors how an investigation proceeds, so it tells the story of an investigation without extra authoring.

Every block is directly editable, and you can rewrite, reorder, or remove anything in the notebook.
You can also add more context, as needed.

You can share a saved notebook with your teammates and reload it as context for a new or continuing investigation in a Grafana Assistant investigation.
This way, the next investigation builds on what was already learned.

![A notebook with a latency investigation](./screenshot-notebook-v13.3.png)
<!-- TODO: Update screenshot -->

A notebook has the following benefits:

- Provides a space to persist what you learned from your Grafana Assistant chats.
- Removes the need for incident-specific dashboards that contribute to dashboard sprawl.
- Doesn't require you to declare an incident to be able to generate an investigation artifact, providing a space for pre-escalation work.
- Keeps your investigation notes within Grafana rather than in external tools, like chat apps, wikis, or stand-alone documents.

Many investigations never become incidents, but the pre-escalation work often includes important signals, and notebooks let you keep that.
Additionally, they provide reusable context you can return to the next time something similar happens.
Each investigation in a notebook makes the next one faster.

## Notebooks, Dashboards, and Workspace

Notebooks offer the following advantages over other tools for recording investigations:
<!-- TODO: Refine this section -->

<!-- prettier-ignore-start -->

| Feature | Pro  | Con                                                     |
| ------- | ---------- | ------------------------------------------------------- |
| Dashboard | Reusable | <ul><li>You have to design the dashboard while you're still in the investigation stage.</li><li>Dashboard is no longer a curated surface.</li></ul>                            |
| Workspace canvas | No design concerns | <ul><li>Ephemeral</li><li>Agent-authored</li><li>Not editable</li></ul>                                                                                       |
| Notebook | <ul><li>Scratch pad while you work that you can clean up later</li><li>Picks up where the Workspace canvas leaves off</li><li>Human-authored and editable.</li><li>Reusable</li></ul> |    |

<!-- prettier-ignore-end -->

## Manage notebooks

The **Notebooks** page lists all of the notebooks in your organization, along with the following details:

- Title
- Author username
- Tags
- Creation date
- Date of last update

![Notebooks page](./screenshot-manage-notebooks-v13.3.png)
<!-- TODO: Update screenshot -->

You can search the page by notebook title and filter by tags or by notebooks you authored.

Each notebook row includes and **Edit** button and a menu where you can access the following actions:

- Copy a shareable link
- Export by copying the raw Markdown
- Export by downloading a .md file
- Delete

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
1. Update the title of the notebook to something descriptive and searchable.
1. Add tags to further define the subject of your notebook.
1. Start typing to create a text block or click one of the other options to add:

   - **Heading**: Adds an H3 heading.
   - **Paragraph**: The default. Use this to revert to paragraph text if you've previously selected another option.
   - **Code**: Select a language to write the code, like plain text, Go, or SQL.
   - **Visualization**: Opens the panel query editor with a graph panel below it.

1. Add as many blocks as you need.

    You can duplicate or delete blocks.

1. In the toolbar, take the following actions, as needed:

   - Click the undo and redo icons at the top of the notebook to revert or reinstate changes.
   - Change the time range of the notebook.
   - Change the refresh rate of the notebook.

1. When you've finished making changes, click **View** to leave edit mode.

You don't need to save a notebook because it auto-saves throughout the creation process.

You can also get a share link, export, and delete a notebook from this screen.

## Create notebooks from Grafana Assistant Workspace

<!-- TODO: Confirm this is the desired workflow given new Pages UI -->

When you complete a chat with the Grafana Assistant in Workspace, notebooks help you pick up where the canvas leaves off.

While you investigate in Workspace, the canvas assembles the work as an ephemeral notebook of the questions, panels, and findings.
The Assistant builds the canvas autonomously in **Investigation** mode, or by way of your chat.

When the canvas is worth keeping, you can direct Assistant to create a notebook or click the option:

![Canvas with the option to create a notebook](./screenshot-create-notebook-v13.3.png)

## Add notebooks to incidents

You can add a notebook to an incident or declare an incident based on your notebook.

To associate a notebook with an incident, follow these steps:

1. Navigate to **Notebooks**.
1. Open the notebook you want to add.
1. Click the menu in the top-right corner and click **IRM**.
1. Choose one of the following options:

   - **Declare incident**: Complete the form in the **Declare incident** dialog box. Then click **Declare incident**. You'll then be taken to **Incidents** with your new incident open.
   - **Attach to incident**: In the dialog box, select an incident to attach the notebook to and add a contextual caption. Then click **Attach**.

## Edit notebooks

To edit a notebook, follow these steps:

1. Navigate to **Notebooks**.
1. Click the title of the notebook you want to update.
1. Click **Edit** at the top of the notebook to leave view mode.
1. Make any needed updates.

   Note that you might need to expand panel queries to edit them as they might be collapsed, by default.

1. When you've finished making changes, click **View** to leave edit mode.

You don't need to save a notebook because it auto-saves throughout the creation process.
