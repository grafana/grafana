# Contributing to documentation

This documents guides you through the process of contributing to the Grafana documentation. Make sure you've read the guide for [Contributing to Grafana](/CONTRIBUTING.md).

## Your first contribution

If you’re unsure about where to start, check out some of our [open docs issues](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3Atype%2Fdocs).

Sometimes it can be difficult to understand an issue when you're just getting started. Refer to this list of [beginner-friendly issues](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3Atype%2Fdocs+label%3A"beginner+friendly") for tasks suitable for first-time contributors.

When you’ve found an issue you want to work on, please comment on the issue to let other people know you intend to work on it.

If you encounter any misspellings or violations to the style guide, please let us know by submitting an issue (or just fix them if they are minor changes).

On every page in the [documentation](https://grafana.com/docs/) are two links in the upper right corner:

- **Edit this page** takes you directly to the file on GitHub where you can contribute a fix.
- **Request doc changes** prepares an issue on GitHub with relevant information already filled in.

## Join our community

For general discussions on documentation, you’re welcome to join the `#docs` channel on our [public Grafana Slack](http://slack.raintank.io) team.

## Style and formatting

All Grafana documentation is written using [Markdown](https://en.wikipedia.org/wiki/Markdown), and can be found in the [docs](/docs) directory in the [Grafana GitHub repository](https://github.com/grafana/grafana). The [documentation website](https://grafana.com/docs) is generated with [Hugo](https://gohugo.io) which uses [Blackfriday](https://github.com/russross/blackfriday) as its Markdown rendering engine.

### Documentation structure

The Grafana documentation is organized into topics, called _sections_. You can take a look at the current build at [grafana.com/docs/](https://grafana.com/docs/).

Each top-level section is located under the [docs/sources](/docs/sources) directory. Subsections are added by creating a subdirectory in the directory of the parent section.

For each section, an `_index.md` file provides an overview of the topic.

### Style guide

Refer to the [Documentation style guide](style-guides/documentation-style-guide.md) for information about Grafana style, word choice, and grammar conventions.

### Spelling

The [codespell](https://github.com/codespell-project/codespell) tool is run for every change to catch common misspellings.
