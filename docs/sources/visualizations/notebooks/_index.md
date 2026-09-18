---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notebooks
weight: 200
description: Create and manage notebooks, a linear, narrative artifact for investigations that include text and panel cells.
---

# Notebooks

A notebook is a linear page of cells.
Text cells hold narrative and notes, and panel cells hold queries that render inline.
The sequence mirrors how an investigation proceeds, so it tells the story of an investigation without extra authoring.

Every cell is directly editable, and you can rewrite, reorder, or remove anything in the notebook.
You can also add more context, as needed.
You can share a saved notebook with your teammates and reload it as context for a new or continuing investigation in a Grafana Assistant investigation.
This way, the next investigation builds on what was already learned.

<!-- TODO: screeenshot here -->

A notebook has the following benefits:

- Provides a space to persist what you learned from your Grafana Assistant chats.
- Removes the need for incident-specific dashboards that contribute to dashboard sprawl.
- Doesn't require you to declare an incident to be able to generate an investigation artifact, providing a space for pre-escalation work.
- Keeps your investigation notes within Grafana rather than in external tools, like chat apps, wikis, or stand-alone documents.

Most investigations never become incidents, but the pre-escalation work is often where the most important signal lives, and notebooks let you keep that.
They provide reusable context you can return to the next time something similar happens.
Each investigation in a notebook makes the next one faster.

## Notebooks vs Dashboards vs Workspaces

Notebooks also offer the following advantages over other tools for recording investigations:

<!-- prettier-ignore-start -->

| Feature | Pro                                                                                                                               | Con                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Dashboard | Reusable | <ul><li>You have to design the dashboard while you're still in the investigation stage.</li><li>Dashboard is no longer a curated surface.</li></ul> |
| Workspace canvas | No design concerns | <ul><li>Ephemeral</li><li>Agent-authored</li><li>Not editable</li></ul>                                                             |
| Notebook | <ul><li>Scratch pad while you work that you can clean up later.</li><li>Human-authored and editable.</li><li>Reusable.</li></ul> |                           |

<!-- prettier-ignore-end -->

## Manage notebooks

On the **Notebooks** page, you can...

## Via Workspace

A notebook comes together in two stages. While the engineer investigates in Workspace, the canvas assembles the work as an ephemeral notebook of the questions, panels, and findings, something to look at instead of the chat transcript. The Assistant builds it autonomously in Investigation Mode, or the engineer drives it through chat. When it's worth keeping, the engineer saves it, which moves them into a dedicated notebook editor outside Workspace where manual editing becomes the primary mode and the Assistant stays available but no longer stands between the engineer and the page.

## Direct

## Via IRM

