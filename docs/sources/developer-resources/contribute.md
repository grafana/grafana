---
keywords:
  - grafana
  - documentation
  - developers
  - resources
labels:
  products:
    - enterprise
    - oss
title: Contribute to Grafana
weight: 300
canonical: https://grafana.com/docs/grafana/latest/developer-resources/contribute/
aliases:
  - ../developers/contribute/ # /docs/grafana/next/developers/contribute/
---

# Contribute to Grafana

This page lists resources for developers who want to contribute to the Grafana software ecosystem or build plugins for Grafana.

## General resources

These resources are useful for all developers.

### Contribute code to Grafana

- [Developer guide](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md): A guide to help you get started developing Grafana software, includes instructions for how to configure Grafana for development.

- [Contributing to documentation](https://github.com/grafana/grafana/blob/main/contribute/documentation): A guide to help you contribute to Grafana documentation, includes links to beginner-friendly issues.

- [Architecture guides](https://github.com/grafana/grafana/tree/main/contribute/architecture): These guides explain Grafana’s background architecture.

- [Create a pull request](https://github.com/grafana/grafana/blob/main/contribute/create-pull-request.md): A guide for new contributors about how to create your first Grafana pull request.

- Report a bug with the [bug report template](https://github.com/grafana/grafana/issues/new?template=0-bug-report.yaml) and include steps to reproduce.
- Submit a [feature request](https://github.com/grafana/grafana/issues/new?template=1-feature_requests.md) to propose improvements.
- Improve our docs with the [documentation contribution guide](https://github.com/grafana/grafana/blob/main/contribute/documentation).
- Help with [issue triage](https://github.com/grafana/grafana/blob/main/contribute/triage-issues.md) by reviewing, labeling, and clarifying open issues.
- Report security vulnerabilities following our [security policy](https://github.com/grafana/grafana/security/policy).

## Communicate with Grafana

Use the right place to ask questions, report problems, and propose changes.

- **GitHub issues and pull requests**: Use for reproducible bugs in core Grafana and maintained plugins, small and actionable feature requests, and code or docs changes via pull requests. Avoid general “how do I” questions. For security issues, follow the [security policy](https://github.com/grafana/grafana/security/policy).
- **Grafana community forums**: Use for questions, troubleshooting, best practices, plugin development Q&A, and early idea discussion. Forums create a searchable public knowledge base that helps others with the same problems and questions. Start here if you are unsure: [Grafana community forums](https://community.grafana.com/).
- **Grafana Community Slack**: Use for quick, time-sensitive chats and networking. Do not rely on Slack for long troubleshooting or decisions. Share outcomes back to a forum topic or GitHub issue/PR to keep a public record: [Grafana Community Slack](https://slack.grafana.com).
- **Not sure where to start?** Start with a forum topic. Maintainers and community members will redirect you if a GitHub issue or pull request is more appropriate.

## Best practices and style

Our [style guides](https://github.com/grafana/grafana/tree/main/contribute/style-guides) outline Grafana style for frontend, backend, documentation, and more, including best practices. Please read through them before you start editing or coding!

- [Backend style guide](https://github.com/grafana/grafana/blob/main/contribute/backend/style-guide.md) explains how we want to write Go code in the future.

- [Documentation style guide](https://grafana.com/docs/writers-toolkit/write/style-guide/) applies to all documentation created for Grafana products.

- [End to end test framework](https://github.com/grafana/grafana/blob/main/contribute/style-guides/e2e.md) provides guidance for Grafana e2e tests.

- [Frontend style guide](https://github.com/grafana/grafana/blob/main/contribute/style-guides/frontend.md) provides rules and guidance on developing in React for Grafana.

- [Redux framework](https://github.com/grafana/grafana/blob/main/contribute/style-guides/redux.md) explains how Grafana handles Redux boilerplate code.

- [Styling Grafana](https://github.com/grafana/grafana/blob/main/contribute/style-guides/styling.md) expands on styling React components with Emotion.

- [Theming Grafana](https://github.com/grafana/grafana/blob/main/contribute/style-guides/themes.md) explains how to use themes and ThemeContext in Grafana code.
