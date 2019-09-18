+++
title = "Documentation"
description = "Contributing to documentation"
type = "docs"
[menu.docs]
parent = "contribute"
weight = 2
+++

# Contributing to documentation

## How do I contribute?

If you’re unsure about where to start, check out some of our [open docs issues](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3Atype%2Fdocs).

Sometimes it can be difficult to understand an issue when you're just getting started. We strive to keep a collection of [beginner-friendly issues](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3Atype%2Fdocs+label%3A"beginner+friendly") that is more suitable for first-time contributors.

When you’ve found an issue you want to work on, you’re encouraged to comment on the issue to let other people know you intend to work on it.

If you encounter any misspellings, or violations to the style guide, please let us know by submitting an issue.

On every page in the documentation there are two links:

- __Edit this page__ takes you directly to the file on GitHub where you can contribute a fix.
- __Request doc changes__ prepares an issue on GitHub with relevant information already filled in.

## Community

If you have questions on a specific issue, post a comment to ask for clarification, or to give feedback.

For general discussions on documentation, you’re welcome to join the `#docs` channel on our [public Grafana Slack](http://slack.raintank.io) team.

## Guidelines

All Grafana documentation is written using [Markdown](https://en.wikipedia.org/wiki/Markdown), and can be found in the [docs](https://github.com/grafana/grafana/tree/master/docs) directory in the [Grafana GitHub repository](https://github.com/grafana/grafana). The [documentation website](https://grafana.com/docs) is generated with [hugo](https://gohugo.io) which uses [Blackfriday](https://github.com/russross/blackfriday) as its Markdown rendering engine.

### Structure

The documentation is organized into topics, called _sections_.

Each top-level section is located under the [docs/sources](https://github.com/grafana/grafana/tree/master/docs/sources) directory. Subsections are added by creating a subdirectory in the directory of the parent section.

For each section, a `_index.md` file is used to provide an overview of the topic.

### Style guide

The [codespell](https://github.com/codespell-project/codespell) tool is run for every change to catch common misspellings.

- "Open source" should be hyphenated when used as an adjective, e.g. _open-source software_. The open form should be preferred when used as a noun, e.g. _Grafana is open source_.
- Use "data source" instead of "datasource" unless used as an identifier, in code or as part of URLs.
- Acronyms should be uppercased, e.g. URL, DNS, or TCP/IP.
