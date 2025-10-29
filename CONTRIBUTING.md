# Contribute to Grafana

Thank you for your interest in contributing to Grafana! We welcome all people who want to contribute in a healthy and constructive manner within our community. To help us create a safe and positive community experience for all, we require all participants to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).

This document is a guide to help you through the process of contributing to Grafana. Be sure to check out the [Grafana Champions program](https://grafana.com/community/champions/?src=github&camp=community-cross-platform-engagement) as you start to contribute. It's designed to recognize and empower individuals who are actively contributing to the growth and success of the Grafana ecosystem.

>**Help us improve!** We'd love to hear about your contributor experience. Take a moment to share your feedback in our [Open Source Contributor Experience Survey](https://gra.fan/ome). Your input helps us make contributing to Grafana better for everyone.

Whether you're a new contributor or a seasoned veteran, we hope these resources help you connect with the community.

#### Interact and be heard

- **Forums:** Do you have a problem, question, or curiosity? Visit our [forums](https://gra.fan/fromgithubtoforums) for a reservoir of knowledge, submit your own questions and answers!
- **Meetups:** Craving in-person connections without the long journeys? [Join your local Grafana & Friends meetup group](https://gra.fan/githubtomeetup)!
- **Community Slack:** Eager for real-time connections with fellow users? Begin a conversation on [Slack](https://gra.fan/githubtoslack).

#### Learn

- **YouTube:** From getting started to exploring newer projects like Pyroscope and Beyla, the [Grafana YouTube channel](https://gra.fan/githubtoyoutube) has what you need to get started!
- **Meetups:** Join a [group near you](https://gra.fan/githubtomeetup) to learn from local experts and ask questions in real time.

#### Make technical contributions

- You can make technical contributions with or without code. Scroll down to see how!

#### Share your story

- **Meetups and blogs:** We’d love to feature your OSS Grafana Labs use case or story at an upcoming Grafana & Friends meetup or on the Grafana blog! Submit your idea [here](https://gra.fan/githubtocca), and we’ll connect with you on next steps if accepted.

## Choose the right channel

Use the right place to ask questions, report problems, and propose changes.

- **[GitHub issues](https://github.com/grafana/grafana/issues) and [pull requests](https://github.com/grafana/grafana/pulls)**: Use for reproducible bugs in core Grafana and maintained plugins, small and actionable feature requests, and code or docs changes via pull requests. Avoid general “how do I” questions. For security issues, follow the [security policy](https://github.com/grafana/grafana/security/policy).
- **Grafana community forums**: Use for questions, troubleshooting, best practices, plugin development Q&A, and early idea discussion. Forums create a searchable public knowledge base that helps others with the same problems and questions. Start here if you are unsure: [Grafana community forums](https://community.grafana.com/).
- **Grafana Community Slack**: Use for quick, time-sensitive chats and networking. Do not rely on Slack for complex troubleshooting or decisions. Share outcomes back to a forum topic or GitHub issue/PR to keep a public record: [Grafana Community Slack](https://slack.grafana.com).
- **Not sure where to start?** Start with a forum topic. Maintainers and community members will redirect you if a GitHub issue or pull request is more appropriate.

## Make technical contributions

We welcome your technical contributions! You can contribute in several ways:

### Contribute Code to Grafana

**What you will need:**

- Follow our [developer guide](contribute/developer-guide.md) to set up your environment.
- Adhere to our [frontend](contribute/style-guides/frontend.md) and [backend](contribute/backend/style-guide.md) style guides.
- Write or update tests ([testing guide](contribute/style-guides/testing.md)).

**Step-by-step:**

1. Browse all [issues](https://github.com/grafana/grafana/issues) to find something to work on. You can also filter by [help wanted](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22).
1. Prepare a clear, descriptive pull request ([how-to guide](contribute/create-pull-request.md)).
1. Ensure you include and run the appropriate tests as part of your pull request.
1. Commit and push your changes. If you encounter merge conflicts, you may rebase your branch onto the main branch.

### Develop a Plugin

Grafana plugins let you extend the platform with new data sources, panels, and more. This is a great way to share your ideas and make a real impact on the Grafana ecosystem.

**Step-by-step:**

1. Read the [plugin development guide](https://grafana.com/developers/plugin-tools) to choose your plugin type and set up your environment.
2. Scaffold your plugin using the recommended tools.
3. Develop and test your plugin locally.
4. Follow best practices for code style, testing, and documentation.
5. Publish your plugin or submit it for review as described in the guide.

### Contribute without code

You can help even if you don't write code:

- Report a bug with the [bug report template](https://github.com/grafana/grafana/issues/new?template=0-bug-report.yaml) and include steps to reproduce.
- Submit a [feature request](https://github.com/grafana/grafana/issues/new?template=1-feature_requests.md) to propose improvements.
- Improve our docs with the [documentation contribution guide](https://github.com/grafana/grafana/blob/main/contribute/documentation).
- Help with [issue triage](https://github.com/grafana/grafana/blob/main/contribute/triage-issues.md) by reviewing, labeling, and clarifying open issues.
- Report security vulnerabilities following our [security policy](https://github.com/grafana/grafana/security/policy).

**Please note:** We do not currently accept contributions for translations. Please do not submit pull requests translating `grafana.json` files - they will be rejected. We do accept contributions to mark up phrases for translation. See [Internationalization](contribute/internationalization.md).

#### Reporting issues

Before submitting a new issue, try to make sure someone hasn't already reported the problem. Look through the [existing issues](https://github.com/grafana/grafana/issues) for similar issues.

Report a bug by submitting a [bug report](https://github.com/grafana/grafana/issues/new?template=0-bug-report.yaml). Make sure that you provide as much information as possible on how to reproduce the bug.

Follow the issue template and add additional information that will help us replicate the problem.

For data visualization issues:

- Query results from the inspect drawer (data tab & query inspector)
- Panel settings can be extracted in the panel inspect drawer JSON tab

For dashboard related issues:

- Dashboard JSON can be found in the dashboard settings JSON model view. You can [send the panel JSON model](https://grafana.com/docs/grafana/latest/troubleshooting/send-panel-to-grafana-support/) to Grafana Labs Technical Support and request help with troubleshooting your issue.

For authentication and alerting, Grafana server logs are useful.

### Triage issues

If you don't have the knowledge or time to code, consider helping with _issue triage_. The community will thank you for saving them time by spending some of yours.

Read more about the ways you can [Triage issues](/contribute/triage-issues.md).

#### Security issues

If you believe you've found a security vulnerability, please read our [security policy](https://github.com/grafana/grafana/security/policy) for more details on reporting.

### Suggest features

If you have an idea of how to improve Grafana, submit a [feature request](https://github.com/grafana/grafana/issues/new?template=1-feature_requests.md).

We want to make Grafana accessible to even more people. Submit an [accessibility issue](https://github.com/grafana/grafana/issues/new?template=2-accessibility.md) to help us understand what we can improve.

### Write documentation

To edit or write technical content, refer to [Contribute to our documentation](/contribute/documentation/README.md). We welcome your expertise and input as our body of technical content grows.

#### Contributor License Agreement (CLA)

Before we can accept your pull request, you need to [sign our CLA](https://grafana.com/docs/grafana/latest/developers/cla/). If you haven't, our CLA assistant prompts you to when you create your pull request.

## Where do I go from here?

- Set up your [development environment](contribute/developer-guide.md).
- Learn how to [contribute to our documentation](contribute/documentation/README.md).
- Get started [developing plugins](https://grafana.com/developers/plugin-tools) for Grafana.
- Look through the resources in the [contribute](contribute) folder.
