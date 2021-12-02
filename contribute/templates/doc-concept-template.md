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

The title of the concept topic will generally be a noun or a gerund. Examples include _Templates_, _Templating_, _Dashboards_, and _Panels_.

A concepts is an information type that explains a concept, idea, or provides an overview or workflow. In the introduction, such as this first paragraph or two, explain what the reader can expect to read.

[Permissions overview](https://grafana.com/docs/grafana/latest/permissions/overview/) is an example of a concept topic.

## Idea

A concept explains _what_ and _why_, but not _how_. If you are a new user, you might look for concept information to learn about what Grafana is, why it might be useful to you, and what the general workflow is.

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
