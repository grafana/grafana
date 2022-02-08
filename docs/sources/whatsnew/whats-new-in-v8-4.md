+++
title = "What's new in Grafana v8.4"
description = "Feature and improvement highlights for Grafana v8.4"
keywords = ["grafana", "new", "documentation", "8.4", "release notes"]
weight = -33
aliases = ["/docs/grafana/latest/guides/whats-new-in-v8-4/"]
[_build]
list = false
+++

# What’s new in Grafana v8.4

We’re excited to announce Grafana v8.4, with a variety of improvements that focus on Grafana’s usability, performance, and security. Read on to learn about Alerting enhancements like a WeCom contact point, improved Alert panel and custom mute timings, as well as visualization improvements and details to help you share playlists more easily. In Grafana Enterprise, we’ve made caching more powerful to save you time and money while loading dashboards, boosted database encryption to keep secrets safe in your Grafana database, and made usability improvements to Recorded Queries, which allow you to track any data point over time.

We’ve summarized what’s new in the release here, but you might also be interested in the announcement blog post as well. If you’d like all the details you can check out the complete [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

# Grafana OSS

## Ease of use

### Share playlists

You can now share links to your playlists the same way as with dashboards, to easily set up the same playlist on multiple devices or kiosks.

### $**interval and $**interval_ms in panel title

We’ve expanded the functionality of this existing and popular feature. You can now use $**interval and $**interval_ms in panel titles. This new function displays the interval that’s used in a specific panel without requiring edit mode.

## Accessibility improvements

We’re continuing to improve accessibility across Grafana, particularly focusing on keyboard navigation and screen readers.

- Navigation: We’ve improved our keyboard navigation support in our main navbar, added focus states, and removed keyboard traps.
- General components (tooltips, color pickers, modals, dropdowns, and so forth): we’ve ensured they’re keyboard navigable, improved focus trapping, and improved screen reader support.
- Time series panel: charts are one of our main areas of limited accessibility. As of 8.4, you can also move a panel and make range selections using your keyboard. - Press arrow keys to move cursor around - Hold Shift to increase cursor speed - Hold space to start rage selection
  You can read our accessibility statement [here](https://grafana.com/accessibility/) and reach out to us with accessibility issues using our community Slack or our community forums.

### New option to configure OpenTelemetry

Grafana is used to visualise traces and metrics, but Grafana itself can be traced as well. For example, users running a Grafana instance can export all the traces of endpoints and database requests to Jaeger, which helps you view all Grafana traffic.

We’re currently using OpenTracing for this, but since the repository is being deprecated, we’ve started our work to migrate to OpenTelemetry and remove OpenTracing. This release is the first step toward this goal. It also adds the option to configure OpenTelemetry instead of OpenTracing.

### Rotate your encryption key

In Grafana 8.3, we upgraded Grafana to use envelope encryption, which adds a layer of indirection to the encryption process. Instead of encrypting all secrets in the database with a single key, Grafana uses a set of keys, called data encryption keys (DEKs), to encrypt them. These data encryption keys are themselves encrypted with a single key encryption key (KEK).

As of 8.4, you can rotate your KEK and quickly re-encrypt your DEKs in case a key is compromised.

Envelope encryption is not enabled by default in version 8.4. You can enable it by adding the term `envelopeEncryption` to the list of feature toggles in your [Grafana configuration](https://grafana.com/docs/grafana/next/administration/configuration/#feature_toggles?mdm=email), or by sending a request to support if you use Grafana Cloud.

## Alerting

### Support for mute timings

[Mute timings](https://grafana.com/docs/grafana/next/alerting/unified-alerting/notifications/mute-timings/) have been a popular request from the community. They are a powerful addition to the new alerting feature set and allow you to suppress specific alerts on a recurring interval or schedule, [contrary to](https://grafana.com/docs/grafana/next/alerting/unified-alerting/notifications/mute-timings/#mute-timings-vs-silences) Silences.

Paired with the existing Silences, this gives you even more control over when alerts should be sent and contact points notified.

### Custom grouping for the Alert Panel

The new Alert Panel displays your alerts and associated alert instances, and supports grouping by one or more custom labels. You can also display all alert instances in an ungrouped list by choosing the custom grouping mode without any configured labels.

Traditionally alerts in the Alert Panel were grouped by the alert rule that created them. When you are monitoring a complex resource like an industrial pump, you typically have multiple alerts defined for that resource to observe different metrics.The new custom grouping feature allows you to view all alert instances for each individual resource by specifying a label such as “pump identifier”.

### WeCom contact point

Starting with Grafana 8.4, you can [configure a WeCom](https://grafana.com/docs/grafana/next/alerting/unified-alerting/contact-points/#wecom) contact point, to send alert notifications to WeCom.

## New panel options

### Bar chart

We’ve expanded the bar chart so that you can:

- Use time for the x axis
- Color bars using a field property (ie, build success)
- Use labels effectively:
  - Skip values when there are too many labels
  - Rotate labels

## Grafana Alerting

Grafana Alerting is now the default alerting experience for all new Open Source installations of Grafana 8.3. Grafana Alerting in 8.3 includes the ability to test contact points and notification routing. Grafana 8.3 also adds the ability to configure and use external, Prometheus-style alert managers from within the Grafana Alerting workflow.

{{< figure src="/static/img/docs/alerting/alerting_8_0.png" max-width="1200px" caption="Grafana Alerting" >}}

## Support for AWS CloudWatch Metrics Insights

Grafana and Amazon Managed Grafana now support AWS Metrics Insights – a fast, flexible, SQL-based query engine that enables you to identify trends and patterns across millions of operational metrics in real time.

You can use Metrics Insights in the AWS CloudWatch plugin. Using this new feature is as simple as selecting the Metric Query type. The Metric Query type has two different modes: a Builder mode and a Code editor mode.

The example below demonstrates using the new Metrics Insight capability to view the top 5 instances with the highest average CPU Utilization, ordered by maximum, in descending order. The code editor has built-in autocompletion support that gives suggestions throughout the composition of the query.

{{< figure src="/static/img/docs/cloudwatch/cloudwatch-code-editor-autocomplete-8.3.0.gif" max-width="1200px" caption="Grafana Alerting" >}}

# Grafana Enterprise

## Recorded Queries

Recorded queries turn “point in time” data into time series.

Recorded queries allow you to export the results of certain non-time series queries to the Enterprise backend in order to store data over time and allow customers to construct their own time series.

This new feature is especially helpful for Enterprise customers using plugins because many new plugins, like ServiceNow and Jira, don’t return time series so customers weren’t able to plot historical data over time. With recorded queries, now they can! For more information

## Assign fine-grained permissions directly to users with the new role picker (beta)

Sometimes the Viewer, Editor, and Admin roles just don’t fit what a certain user needs to do in Grafana. Now you can assign fine-grained roles directly to users, so they can create reports, use Explore mode, create data sources, and perform other specific actions in Grafana. The role picker can be access from the Grafana Admin user management page.

{{< figure src="/static/img/docs/enterprise/enterprise_role_picker_8_3.png" max-width="1200px" caption="Grafana Enterprise Role Picker" >}}

## Use fine-grained access control for Organizations and Licensing (beta)

We’ve added new permissions to fine-grained access control to help you specify actions that users can perform. Now you can assign permissions to manage Organizations and License functions in Grafana, in addition to Users, Data Sources, Reports, and other resources. Fine-grained access control remains in beta and we will continue to add new permissions until all of Grafana’s endpoints are covered. For a complete list of the actions you can permit using fine-grained access control, see the [reference](https://grafana.com/docs/grafana/next/enterprise/access-control/fine-grained-access-control-references/).

## Get your encryption key from a Key Management Service

Grafana’s database contains secrets, like the credentials used to query data sources, send alert notifications and perform other functions within Grafana. These secrets are encrypted using keys, which are usually stored in Grafana’s configuration file. Now you can get your encryption key from Amazon KMS, Azure Key Vault, or Hashicorp Vault. This allows you to centrally manage your Grafana encryption key and reduce the chances it will leak.

In order to support this, we’ve upgraded Grafana Enterprise to use envelope encryption, which complements the KMS integration by adding a layer of indirection to the encryption process. Instead of encrypting all secrets with a single key, Grafana uses a set of keys called data encryption keys (DEKs) to encrypt them. These data encryption keys are themselves encrypted with a single key encryption key (KEK). With envelope encryption, you can store a KEK in your KMS, and still quickly encrypt and decrypt data using DEKs stored within the Grafana database.

## Pay the same for all users, regardless of their permissions

Are you tired of managing user permissions because your license only allows a certain number of Viewers and Editors or Admins? So were we. We’ve added support for combined user pricing, where all users cost the same and fall into the same license bucket in Grafana Enterprise. This is a specific license option and must be updated in your contract. To learn more, refer to our [licensing docs](https://grafana.com/docs/grafana/latest/enterprise/license/license-restrictions/). To switch to combined user pricing, contact your Grafana Labs account team.

{{< figure src="/static/img/docs/enterprise/enterprise_users_8_3.png" max-width="1200px" caption="Grafana Enterprise User Pricing" >}}

## Author dashboards faster with resource caching

Your query editor just became faster. [Query caching](https://grafana.com/docs/grafana/latest/enterprise/query-caching/) improves query performance and sometimes reduces cost, by reducing the number of repetitive queries performed against data sources. Resource caching does the same thing but for resource calls, like retrieving the list of applications in the AppDynamics editor, the list of metrics from Datadog, or the list of values in a template variable dropdown. This makes for a zippier user experience for everyone writing queries in Grafana.

## Review audit logs for more services, like alerting

[Audit logs](https://grafana.com/docs/grafana/latest/enterprise/auditing/) are a record of the actions users perform in Grafana, which you can investigate in case of a security incident or to understand Grafana usage better. We’ve added audit logs for new actions performed against plugins, data sources, library elements, and Grafana’s new alerting service. This ensures that if a user makes a change anywhere in Grafana Enterprise, you’ll have a record of it. For details, refer to the [Auditing docs](https://grafana.com/docs/grafana/latest/enterprise/auditing/).
