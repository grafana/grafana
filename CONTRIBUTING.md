# Contribute to Grafana

Thank you for your interest in contributing to Grafana! We welcome all people who want to contribute in a healthy and constructive manner within our community. To help us create a safe and positive community experience for all, we require all participants to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).

This document is a guide to help you through the process of making technical contributions to Grafana.

Whether you're a new contributer or a seasoned veteran we hope these resources help you connect with the community:

Interact and be heard:

- Forums: Do you have a problem, question, or curiosity? Visit our [forums](https://gra.fan/fromgithubtoforums) for a reservoir of knowledge- submit your own questions and answers!
- Meetups: Craving in-person connections without the long journeys? [Join your local Grafana & Friends meetup group](https://gra.fan/githubtomeetup)!
- Community Slack: Eager for real-time connections with fellow users? Begin a conversation on [Slack](https://gra.fan/githubtoslack).
  Learn:
- YouTube: From getting started to exploring newer projects like Pyroscope and Beyla, the [Grafana YouTube channel](https://gra.fan/githubtoyoutube) has what you need to get started!
- Meetups: Join a [group near you](https://gra.fan/githubtomeetup) to learn from local experts and ask questions in real time.
  Share your story:
- Meetups and blogs: We’d love to feature your OSS Grafana Labs use case or story at an upcoming Grafana & Friends meetup or on the Grafana blog! Submit your idea [here](https://gra.fan/githubtocca) and we’ll connect with you on next steps if accepted.

## Make technical contributions

We welcome your technical contributions! Here are some examples:

- Contribute to the Grafana codebase- check out these [help-wanted issues](<(https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)>)
- Develop community [plugins](https://grafana.com/developers/plugin-tools)
- Report [bugs](https://github.com/grafana/grafana/issues/new?template=0-bug-report.yaml)
- [Triage issues](https://github.com/grafana/grafana/blob/4414b92e93440cc9ed0f281989ee71dc16216a15/contribute/triage-issues.md)
- Report [security vulnerabilities](https://github.com/grafana/grafana/security/policy)
- Submit a [feature request](https://github.com/grafana/grafana/issues/new?template=1-feature_requests.md)
- Write [technical documentation](https://github.com/grafana/grafana/blob/4414b92e93440cc9ed0f281989ee71dc16216a15/contribute/documentation/README.md)

**Please note:** We do not currently accept contributions for translations. Please do not submit pull requests translating grafana.json files - they will be rejected. We do accept contributions to mark up phrases for translation. See [Internationalization](contribute/internationalization.md).

### Your first contribution

Unsure where to begin contributing to Grafana? Start by browsing issues labeled `beginner friendly` or `help wanted`.

- [Beginner-friendly](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) issues are generally straightforward to complete.
- [Help wanted](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) issues are problems we would like the community to help us with regardless of complexity.

If you're looking to make a code change, see how to set up your environment for [local development](contribute/developer-guide.md).

When you're ready to contribute, it's time to [create a pull request](/contribute/create-pull-request.md).

### Develop a plugin

Developing a Grafana plugin is a fantastic way to share your unique ideas with the community, extend the platform’s capabilities, and make a real impact on how people visualize and understand their data. Check out our guide to creating [plugins](https://grafana.com/developers/plugin-tools)

### Report bugs

Before submitting a new issue, try to make sure someone hasn't already reported the problem. Look through the [existing issues](https://github.com/grafana/grafana/issues) for similar issues.

Report a bug by submitting a [bug report](https://github.com/grafana/grafana/issues/new?template=0-bug-report.yaml). Make sure that you provide as much information as possible on how to reproduce the bug.

Follow the issue template and add additional information that will help us replicate the problem.

For data visualization issues:

- Query results from the inspect drawer (data tab & query inspector)
- Panel settings can be extracted in the panel inspect drawer JSON tab

For a dashboard related issues:

- Dashboard JSON can be found in the dashboard settings JSON model view

For authentication and alerting Grafana server logs are useful.

### Triage issues

If you don't have the knowledge or time to code, consider helping with _issue triage_. The community will thank you for saving them time by spending some of yours.

Read more about the ways you can [Triage issues](/contribute/triage-issues.md).

#### Security issues

If you believe you've found a security vulnerability, please read our [security policy](https://github.com/grafana/grafana/security/policy) for more details on reporting.

### Suggest enhancements

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
