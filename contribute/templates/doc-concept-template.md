DELETE THIS LINE: If draft = false, then the document will not be built in the doc site. If the date is earlier than the build date, than the document will not show in the build site. Use these settings to control whether future content is shown in the doc site.
+++
draft = "false"
date = "yyyy-mm-dd"
title = "Title in sentence case"
description = "Description in title case"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
[menu.docs]
name = "Name of topic"
identifier = "identifier"
parent = "menu parent"
weight = 100
+++

# Concept

The title of the concept topic will generally be a noun or a gerund. Examples include Templates, Templating, Dashboards, and panels.

Concepts are topic types for any information that doesn't involve task lists or reference information. Ideally you use concept elements to explain concepts, ideas, overviews, workflows, and the like. In the intro section, this first paragraph or two, you should explain to the user what to expect in this topic or section.

[Permissions overview](https://grafana.com/docs/grafana/latest/permissions/overview/) is an example of a concept topic.

## Idea

Concept topics or sections explain *what* and *why*. They do not explain *how*. If you are a new user, you might look for concept information to learn about what Grafana is, why it might be useful to you, and what the general workflow is. 

## Workflow

Continuing the example in the previous section, here is a sample Grafana workflow. 

1. Install Grafana. <link to task for installing Grafana>
2. Set up data sources. <link to data sources concept topic, which links to data source task topics>
3. Create panels. <link to panel concept topic, which links to tasks>
4. Create dashboards.  <link to panel concept topic, which links to tasks>
5. Enter queries. <link to query editor concept topic>
6. Add users. <link to user management concept topic, which links to tasks>
7. Create playlists. <link to Playlist topic that contains concept information and tasks>

## Next steps

Concept tasks often link to related information, including *tasks* related to the concept and *reference* topics related to the concept.
