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

For more ways to contribute, check out the [Open Source Guides](https://opensource.guide/how-to-contribute/).

### Report bugs

Report a bug by submitting a [bug report](https://github.com/grafana/grafana/issues/new?labels=type%3A+bug&template=1-bug_report.md). Make sure that you provide as much information as possible on how to reproduce the bug.

Before submitting a new issue, try to make sure someone hasn't already reported the problem. Look through the [existing issues](https://github.com/grafana/grafana/issues) for similar issues.

#### Security issues

If you believe you've found a security vulnerability, please read our [security policy](https://github.com/grafana/grafana/security/policy) for more details.

### Suggest enhancements

If you have an idea of how to improve Grafana, submit an [enhancement request](https://github.com/grafana/grafana/issues/new?labels=type%3A+feature+request&template=2-feature_request.md).

We want to make Grafana accessible to even more people. Submit an [accessibility issue](https://github.com/grafana/grafana/issues/new?labels=type%3A+accessibility&template=3-accessibility.md) to help us understand what we can improve.

### Triage issues

If you don't have the knowledge or time to code, consider helping with _issue triage_. The community will thank you for saving them time by spending some of yours.

Read more about the ways you can [Triage issues](/contribute/triage-issues.md).

### Answering questions

- [ ] The pull request contains a title that explains it. It follows [PR and commit messages guidelines](#Pull-Requests-titles-and-message).
- [ ] The pull request contains necessary links to issues.
- [ ] The pull request contains commits with messages that are small and understandable. It follows [PR and commit messages guidelines](#Pull-Requests-titles-and-message).
- [ ] The pull request does not contain magic strings or numbers that could be replaced with an `Enum` or `const` instead.

It's important to us to help these users, and we'd love your help. Sign up to our [community site](https://community.grafana.com/), and start helping other Grafana users by answering their questions.

### Your first contribution

Unsure where to begin contributing to Grafana? Start by browsing issues labeled `beginner friendly` or `help wanted`.

- [ ] The pull request does not increase the Angular code base.
  > We are in the process of migrating to React so any increment of Angular code is generally discouraged.
- [ ] The pull request does not contain uses of `any` or `{}` without comments describing why.
- [ ] The pull request does not contain large React components that could easily be split into several smaller components.
- [ ] The pull request does not contain back end calls directly from components, use actions and Redux instead.
- [ ] The pull request follows our [styling with Emotion convention](./style_guides/styling.md)
  > We still use a lot of SASS, but any new CSS work should be using or migrating existing code to Emotion

If you're looking to make a code change, see how to set up your environment for [local development](contribute/developer-guide.md).

When you're ready to contribute, it's time to [Create a pull request](/contribute/create-pull-request.md).

#### Contributor License Agreement (CLA)

Before we can accept your pull request, you need to [sign our CLA](https://grafana.com/docs/contribute/cla/). If you haven't, our CLA assistant prompts you to when you create your pull request.

## Where do I go from here?

- Set up your [development environment](contribute/developer-guide.md).
- Learn how to [contribute documentation](contribute/documentation.md).
- Get started [developing plugins](https://grafana.com/docs/plugins/developing/development/) for Grafana.
