---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/grafana-and-legacy-templates/
description: Compare the definitions, functions, and data available to Grafana and Legacy notification templates, and learn how to adapt templates when you replace a Legacy integration.
keywords:
  - grafana
  - alerting
  - notification templates
  - legacy
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Grafana and Legacy notification templates
menuTitle: Grafana and Legacy templates
weight: 106
refs:
  template-language-dot:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/#dot
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/#dot
  import-alertmanager-configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/import-alertmanager-configuration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/import-alertmanager-configuration/
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
---

# Grafana and Legacy notification templates

Grafana and Legacy notification templates differ in their named definitions, built-in defaults, and functions. Integrations also differ in the data they provide to templates. Review these differences before you share templates or replace a Legacy integration.

## How integrations select templates

Each integration's version determines whether it uses Grafana or Legacy templates. The UI identifies Mimir-compatible templates with a **Legacy** badge. In the API, the template kind is `grafana` for Grafana templates and `mimir` for Legacy templates.

| Integration | API integration version | Notification templates | API template kind |
| ----------- | ----------------------- | ---------------------- | ----------------- |
| Grafana     | `v1`                    | Grafana                | `grafana`         |
| Legacy      | `v0mimir1`, `v0mimir2`  | Legacy                 | `mimir`           |

Each integration selects templates from its own version, not from the contact point or the alert's origin. A contact point can contain a mix of Grafana and Legacy integrations. Hosting an integration in Grafana doesn't make it use Grafana templates.

## Differences between Grafana and Legacy templates

Within an Alertmanager configuration, Grafana and Legacy templates differ as follows:

| Property               | Grafana templates                                                                                                                                                                                                         | Legacy templates                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| User-defined templates | Only definitions in Grafana template groups.                                                                                                                                                                              | Only definitions in Legacy template groups.                                                                                                 |
| Built-in templates     | Alertmanager defaults with Grafana additions and overrides, including overridden `__subject` and `__text_alert_list` definitions and additional `default.title`, `default.message`, and `__text_values_list` definitions. | Alertmanager defaults, including `__subject` and `__text_alert_list`, but not the Grafana `default.title` or `default.message` definitions. |
| Functions              | Alertmanager functions, Mimir helpers, and the Grafana `coll`, `data`, `tmpl`, and `time` namespaces.                                                                                                                     | Alertmanager functions and Mimir helpers.                                                                                                   |
| Notification data      | Alertmanager notification data plus additional fields, such as dashboard and silence URLs and alert values.                                                                                                               | Alertmanager notification data only; no Grafana-only fields.                                                                                |

Grafana and Legacy templates both include Mimir helpers such as `grafanaExploreURL` and `queryFromGeneratorURL`. The presence of one of these functions doesn't tell you whether a template is Grafana or Legacy.

The integration determines which settings support templating and what data it supplies when rendering those settings. Grafana integrations provide extended alert fields, including dashboard, panel, and silence URLs, evaluation values, and organization information. Some values depend on the alert's annotations and evaluation data. Legacy integrations don't provide these extended fields, even for alerts that originate in Grafana. The [notification template reference](ref:notification-template-reference) distinguishes shared fields and functions from Grafana-only additions.

## Named templates and dependencies

An integration setting that supports templates can contain text and Go template expressions, or call a named template. For example, a notification template group can contain this definition:

```go
{{ define "team.message" }}{{ .Status }}: {{ len .Alerts }} alerts{{ end }}
```

In a setting that supports notification templates, call the definition by name:

```go
{{ template "team.message" . }}
```

The dependency is on `team.message`, not on the template group's title or filename. Renaming the group doesn't rename the definition or update calls to it. If the definition calls other templates, those definitions must also be available to the integration.

Grafana and Legacy templates have separate _definition namespaces_: the collections of names that integrations can look up. A Grafana integration searches only the Grafana definition namespace; a Legacy integration searches only the Legacy definition namespace. For example, defining `team.message` only in a Grafana template group doesn't make it available to a Legacy integration.

The same name can exist independently in both definition namespaces. Template group titles, unlike definition names, must be unique across both kinds: a Grafana group and a Legacy group can't share a title. Within one namespace, definitions are shared, so changing one can affect multiple contact points. Use unique definition names within each namespace to avoid one group overriding another.

## Template selection versus dot and test data

The choice of Grafana or Legacy templates is separate from the Go template [dot value](ref:template-language-dot) (`.`):

- **Template selection:** The integration's version determines which named definitions and functions it can use.
- **Dot:** The data passed to a particular template call. At the notification level, dot contains the alert group. Inside `range .Alerts`, dot refers to one alert.

For example, `{{ template "team.message" . }}` looks up `team.message` in the integration's definition namespace and passes the current dot value to it. The `team.message` definition above expects notification-level data because it accesses `.Alerts`.

A definition that expects a single alert can access that alert's labels instead:

```go
{{ define "team.alert" }}{{ .Labels.alertname }}: {{ .Status }}{{ end }}
```

Call that definition once for each alert:

```go
{{ range .Alerts }}{{ template "team.alert" . }}{{ "\n" }}{{ end }}
```

The loop changes the data passed to `team.alert`, not the available template definitions or functions. A Legacy integration still looks up `team.alert` in the Legacy definition namespace; a Grafana integration looks it up in the Grafana definition namespace.

The template-testing API reports which data scope rendered the template in the response field `scope`: `.` (notification data), `.Alerts` (the alert list), or `.Alert` (the first alert). The request's `kind` field (`grafana` or `mimir`) selects which template set is used. `.Alert` in a test result isn't a field on notification data.

A successful test with one alert doesn't mean the definition accepts the whole notification group. Test the integration's actual template call as well as the definition.

## Template compatibility when importing or replacing integrations

When you [import an Alertmanager configuration](ref:import-alertmanager-configuration), Grafana runs the imported integrations with Mimir-compatible behavior and creates Legacy template groups (API kind `mimir`). A Grafana template with the same name doesn't replace an imported template.

If an import renames a conflicting template group, it doesn't rewrite the `define` names or template calls inside that group. Check definition names across imports, not only filenames or group titles.

When replacing a Legacy integration with a Grafana integration, adapt the Legacy integration's template dependencies for use with Grafana templates:

1. Check that every named definition it calls, including definitions called by other templates, exists in the Grafana definition namespace.
1. Check built-in defaults, functions, and data fields. Don't assume copying the template text makes it compatible.
1. Verify that each template receives the expected dot value.
1. Test notification delivery and message content for the replacement integration, including resolved notifications if enabled.

Template errors don't always prevent delivery. Depending on the integration and setting, an error can prevent delivery or leave part of the message empty. Check the received content as well as the delivery status.

For the integration replacement workflow, refer to [contact points](ref:contact-points).
