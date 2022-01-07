DELETE THIS LINE: If draft = false, then the document will not be built in the doc site. If the date is earlier than the build date, than the document will not show in the build site. Use these settings to control whether future content is shown in the doc site.
+++
draft = "false"
date = "yyyy-mm-dd"
title = "Title in sentence case"
description = "Description in sentence case"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
[menu.docs]
name = "Name of topic"
identifier = "identifier"
parent = "menu parent"
weight = 100
+++

# Concept

The title of the concept topic will generally be a noun or a gerund, prefaced by the word "About" for easier skimming. Examples include _About templates_, _About value mapping_, and _About dashboards_.

A concept is an information type that helps readers _ understand_ by explaining a concept or idea or providing an overview of workflow. 

In the first sentence, explain what the concept is succinctly for easier reading. In the next sentence (or two or three) explain the value or benefit that is provided.

[Permissions overview](https://grafana.com/docs/grafana/latest/permissions/overview/) is an example of a concept topic.

## Idea

A concept explains _what_ and _why_, but not _how_. If you are a new user, you might look for concept information to learn about what Grafana is, why it might be useful to you, and what the general workflow is.

A sample concept might look like this:

# Example: About Grafana panel libraries

A library panel is a reusable panel that you can use in any dashboard. When you make a change to a library panel, that change propagates to all instances of where the panel is used. Library panels streamline reuse of panels across multiple dashboards.

You can save a library panel in a folder alongside saved dashboards.

## Workflow

A sample Grafana workflow might look as follows:

1. Install Grafana. <link to a task for installing Grafana>
1. Set up a data source. <link to a data source concept, which links to a data source task>
1. Create panels. <link to a panel concept, which links to a task>
1. Create dashboards. <link to a panel concept, which links to a task>
1. Enter queries. <link to a query editor concept>
1. Add users. <link to a user-management concept, which links to a task>
1. Create playlists. <link to a playlist concept or task>

Try and link a concept to related information, such as a _task_ or _reference_.
