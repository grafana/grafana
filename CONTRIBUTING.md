# Contributing to Grafana

Thank you for your interest in contributing to Grafana! We welcome all people who want to contribute in a healthy and constructive manner within our community. To help us create a safe and positive community experience for all, we require all participants to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).

This document is a guide to help you through the process of contributing to Grafana.

## Become a contributor

You can contribute to Grafana in several ways. Here are some examples:

- Contribute to the Grafana codebase.
- Report and triage bugs.
- Develop community plugins and dashboards.
- Write technical documentation and blog posts, for users and contributors.
- Organize meetups and user groups in your local area.
- Help others by answering questions about Grafana.

**Please note:** We do not currently accept contributions for translations. Please do not submit pull requests translating grafana.json files - they will be rejected. We do accept contributions to mark up phrases for translation. See [Internationalization](contribute/internationalization.md).

For more ways to contribute, check out the [Open Source Guides](https://opensource.guide/how-to-contribute/).

### Report bugs

Before submitting a new issue, try to make sure someone hasn't already reported the problem. Look through the [existing issues](https://github.com/grafana/grafana/issues) for similar issues.

Report a bug by submitting a [bug report](https://github.com/grafana/grafana/issues/new?labels=type%3A+bug&template=1-bug_report.md). Make sure that you provide as much information as possible on how to reproduce the bug.

Follow the issue template and add additional information that will help us replicate the problem.

For data visualization issues:

- Query results from the inspect drawer (data tab & query inspector)
- Panel settings can be extracted in the panel inspect drawer JSON tab

For a dashboard related issues:

- Dashboard JSON can be found in the dashboard settings JSON model view

For authentication and alerting Grafana server logs are useful.

#### Security issues

If you believe you've found a security vulnerability, please read our [security policy](https://github.com/grafana/grafana/security/policy) for more details.

### Suggest enhancements

If you have an idea of how to improve Grafana, submit an [enhancement request](https://github.com/grafana/grafana/discussions/new).

We want to make Grafana accessible to even more people. Submit an [accessibility issue](https://github.com/grafana/grafana/issues/new?labels=type%3A+accessibility&template=3-accessibility.md) to help us understand what we can improve.

### Write documentation

To edit or write technical content, refer to [Contribute to our documentation](/contribute/documentation/README.md). We welcome your expertise and input as our body of technical content grows.

### Triage issues

If you don't have the knowledge or time to code, consider helping with _issue triage_. The community will thank you for saving them time by spending some of yours.

Read more about the ways you can [Triage issues](/contribute/triage-issues.md).

### Answering questions

If you have a question and you can't find the answer in the [documentation](https://grafana.com/docs/), the next step is to ask it on the [community site](https://community.grafana.com/).

It's important to us to help these users, and we'd love your help. Sign up to our [community site](https://community.grafana.com/), and start helping other Grafana users by answering their questions.

### Your first contribution

Unsure where to begin contributing to Grafana? Start by browsing issues labeled `beginner friendly` or `help wanted`.

- [Beginner-friendly](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) issues are generally straightforward to complete.
- [Help wanted](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) issues are problems we would like the community to help us with regardless of complexity.

If you're looking to make a code change, see how to set up your environment for [local development](contribute/developer-guide.md).

When you're ready to contribute, it's time to [Create a pull request](/contribute/create-pull-request.md).

#### Contributor License Agreement (CLA)

Before we can accept your pull request, you need to [sign our CLA](https://grafana.com/docs/grafana/latest/developers/cla/). If you haven't, our CLA assistant prompts you to when you create your pull request.

## Where do I go from here?

- Set up your [development environment](contribute/developer-guide.md).
- Learn how to [contribute documentation](contribute/README.md).
- Get started [developing plugins](https://grafana.com/docs/grafana/latest/developers/plugins/) for Grafana.
- Look through the resources in the [contribute](contribute) folder.
