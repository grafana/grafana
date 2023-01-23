---
aliases:
  - /docs/grafana/latest/guides/whats-new-in-v9-4/
description: Feature and improvement highlights for Grafana v9.4
keywords:
  - grafana
  - new
  - documentation
  - '9.4'
  - release notes
title: What's new in Grafana v9.4
weight: -33
---

# What’s new in Grafana v9.4

Welcome to Grafana 9.4! Read on to learn about [add short list of what's included in this release]. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Feature

[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]

Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).

> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).

## Alert email templating

We've improved the design and functionality of email templates to make template creation much easier and more customizable. The email template framework utilizes MJML to define and compile the final email HTML output. Sprig functions in the email templates provide more customizable template functions.

{{< figure src="/static/img/docs/alerting/alert-templates-whats-new-v9.3.png" max-width="750px" caption="Email template redesign" >}}

## Log details redesign

The details section of a log line has been updated. Previously some of the interactions, such as filtering, showing statistics or toggling the visibility were split across "Labels" and "Detected fields". With the recent changes those two sections were unified into one and the interactions are available for all fields.

{{< figure src="/static/img/logs/log-details-whats-new-9-4.png" max-width="750px" caption="Log details redesign with interactions" >}}

## Service account expiration dates

We have included a new configuration option, disabled by default. This will allow us to require an expiration date limit for all newly created service account tokens.

This will not affect existing tokens, however newly created tokens will require an expiration date that doesn't exceed the configuration option `token_expiration_day_limit`.

## RBAC support for Grafana OnCall plugin

We're rolling out RBAC support to Grafana plugins, with Grafana OnCall being the first plugin to fully support RBAC.
Previously Grafana OnCall relied on the Grafana basic roles (eg. Viewer, Editor, and Admin) for authorization within
the plugin.

Before RBAC support in Grafana OnCall, it was only possible to allow your organization's users to either view everything,
edit everything, or be an admin (which allowed edit access plus a few additional behaviours). With this new functionality,
organizations will be able to harness fine-grained access control within Grafana OnCall.

For example, you could assign a user in your organization, whom has the Viewer basic role (note that a user must still
have a basic role assigned) the new Grafana OnCall RBAC role of "Schedules Editor". This would allow the user to view
everything in Grafana OnCall, and also allow them to edit OnCall Schedules

## SAML auto login

We're added auto login feature support for SAML authentication. It can be turned on with `auto_login` configuration option. OAuth
auto login feature was also revamped to have a unified configuration style among all authentication providers. Instead of
`oauth_auto_login`, new `auto_login` option should be used to enable automatic login for specific OAuth provider.
