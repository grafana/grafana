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
The sequence tells the story of your investigation as you work, without additional authoring.

Every block is directly editable, and you can rewrite, reorder, remove, or add more context, as needed.

A notebook:

- Removes the need for incident-specific dashboards that contribute to dashboard sprawl.
- Doesn't require you to declare an incident to be able to generate an investigation artifact, providing a space for pre-escalation work.
- Provides a space to persist what you learned from your Grafana Assistant chats.
- Keeps your investigation notes within Grafana rather than in external tools, like chat apps, wikis, or stand-alone documents.

![A notebook with a latency investigation](./screenshot-notebook-v13.3.png)
<!-- TODO: Update screenshot -->

You can share a saved notebook with your teammates and reload it as context for a new or continuing investigation in a Grafana Assistant investigation.
This way, the next investigation builds on what was already learned.

Many investigations never become incidents, but the pre-escalation work often includes important signals, and notebooks let you keep that.
Additionally, they provide reusable context you can return to the next time something similar happens.
Each investigation in a notebook makes the next one faster.

## When to use notebooks

Dashboards, the Workspace canvas, and notebooks each support investigations in a different way. They differ in design effort, ease of editing, and reuse.

- **Dashboards** are reusable, curated views. Building one during an investigation requires design decisions while you're still exploring, and adding investigative work can make the dashboard less curated.
- **The Workspace canvas** is a temporary exploration space. You can explore without design work, but an agent creates the canvas, you can't edit it, and it doesn't persist.
- **Notebooks** are a scratchpad you can refine and reuse. A notebook picks up where the Workspace canvas leaves off. You write and edit it during an investigation, then clean it up into a reusable record.

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

Each notebook row includes an **Edit** button and a menu where you can access the following actions:

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
1. (Optional) Update the title of the notebook to something descriptive and searchable.
1. (Optional) Add tags to further define the subject of your notebook.
1. Start typing to create a text block or click one of the other options to add:

   - **Heading**: Adds an H3 heading.
   - **Paragraph**: The default. Use this to revert to paragraph text if you've previously selected another option.
   - **Code**: Adds a code block. Select a language, like Go, SQL, or plain text.
   - **Visualization**: Opens the panel query editor with a graph panel below it.

1. Add as many blocks as you need.

    You can also duplicate or delete blocks.

1. In the toolbar, take the following actions, as needed:

   - Click the undo and redo icons at the top of the notebook to revert or reinstate changes.
   - Change the time range of the notebook.
   - Change the refresh rate of the notebook.

1. When you've finished making changes, click **View** to leave edit mode.

You don't need to save a notebook because it auto-saves throughout the creation process.

After you start adding to a notebook, you can access options to share, export, or delete it in the toolbar.

## Create notebooks from Grafana Assistant Workspace

When you complete a chat with the Grafana Assistant in Workspace, notebooks help you pick up where the canvas leaves off.

While you investigate in Workspace, the canvas assembles the work as a temporary collection of questions, panels, and findings.
The Assistant builds the canvas autonomously in **Investigation** mode, or by way of your chat.

When the canvas is worth keeping, you can direct Assistant to create a notebook or click the **Create notebook** option:

![Canvas with the option to create a notebook](./screenshot-create-notebook-v13.3.png)

## Notebooks and incidents

You can attach a notebook to an existing incident or declare an incident based on your notebook.

### Attach notebooks to incidents

To attach a notebook to an existing incident, follow these steps:

1. Navigate to **Notebooks**.
1. Open the notebook you want to attach.
1. Click the menu in the top-right corner.
1. Select **IRM > Attach to incident**.
1. In the dialog box that opens, select the incident to which you want to attach the notebook.
1. (Optional) Add a caption to provide context.
1. Click **Attach**.

### Declare incidents from notebooks

To declare an incident from a notebook, follow these steps:

1. Navigate to **Notebooks**.
1. Open the notebook you want to use.
1. Click the menu in the top-right corner.
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

You don't need to save a notebook because it auto-saves throughout the creation process.
