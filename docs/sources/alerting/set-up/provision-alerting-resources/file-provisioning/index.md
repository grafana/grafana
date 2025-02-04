---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/
description: Create and manage resources using file provisioning
keywords:
  - grafana
  - alerting
  - alerting resources
  - file provisioning
  - provisioning
labels:
  products:
    - enterprise
    - oss
menuTitle: Use configuration files to provision
title: Use configuration files to provision alerting resources
weight: 100
refs:
  export_mute_timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-mute-timings
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-mute-timings
  export_alert_rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-alert-rules
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-alert-rules
  export_contact_points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-contact-points
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-contact-points
  provisioning_env_vars:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#using-environment-variables
  reload-provisioning-configurations:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/admin/#reload-provisioning-configurations
  export_policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-the-notification-policy-tree
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-the-notification-policy-tree
  provisioning:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
  export_templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-notification-template-groups
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-notification-template-groups
---

# Use configuration files to provision alerting resources

Manage your alerting resources using configuration files that can be version controlled. When Grafana starts, it provisions the resources defined in your configuration files. [Provisioning](ref:provisioning) can create, update, or delete existing resources in your Grafana instance.

This guide outlines the steps and references to provision alerting resources using YAML files. For a practical demo, you can clone and try [this example using Grafana OSS and Docker Compose](https://github.com/grafana/provisioning-alerting-examples/tree/main/config-files).

{{< admonition type="note" >}}

- [Provisioning Grafana](/docs/grafana/<GRAFANA_VERSION>/administration/provisioning) with configuration files is not available in Grafana Cloud.

- You cannot edit provisioned resources from files in Grafana. You can only change the resource properties by changing the provisioning file and restarting Grafana or carrying out a hot reload. This prevents changes being made to the resource that would be overwritten if a file is provisioned again or a hot reload is carried out.

- Provisioning using configuration files takes place during the initial set up of your Grafana system, but you can re-run it at any time using the [Grafana Admin API](/docs/grafana/<GRAFANA_VERSION>/developers/http_api/admin#reload-provisioning-configurations).

- Importing an existing alerting resource results in a conflict. First, when present, remove the resources you plan to import.
  {{< /admonition >}}

Details on how to set up the files and which fields are required for each object are listed below depending on which resource you are provisioning.

## Import alert rules

Create or delete alert rules using provisioning files in your Grafana instance(s).

1. Find the alert rule group in Grafana.
1. [Export](ref:export_alert_rules) and download a provisioning file for your alert rules.
1. Copy the contents into a YAML or JSON configuration file and add it to the `provisioning/alerting` directory of the Grafana instance you want to import the alerting resources to.

   Example configuration files can be found below.

1. Restart your Grafana instance (or reload the provisioned files using the Admin API).

Here is an example of a configuration file for creating alert rules.

```yaml
# config file version
apiVersion: 1

# List of rule groups to import or update
groups:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the rule group
    name: my_rule_group
    # <string, required> name of the folder the rule group will be stored in
    folder: my_first_folder
    # <duration, required> interval that the rule group should evaluated at
    interval: 60s
    # <list, required> list of rules that are part of the rule group
    rules:
      # <string, required> unique identifier for the rule. Should not exceed 40 symbols. Only letters, numbers, - (hyphen), and _ (underscore) allowed.
      - uid: my_id_1
        # <string, required> title of the rule that will be displayed in the UI
        title: my_first_rule
        # <string, required> which query should be used for the condition
        condition: A
        # <list, required> list of query objects that should be executed on each
        #                  evaluation - should be obtained through the API
        data:
          - refId: A
            datasourceUid: '__expr__'
            model:
              conditions:
                - evaluator:
                    params:
                      - 3
                    type: gt
                  operator:
                    type: and
                  query:
                    params:
                      - A
                  reducer:
                    type: last
                  type: query
              datasource:
                type: __expr__
                uid: '__expr__'
              expression: 1==0
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
              type: math
        # <string> UID of a dashboard that the alert rule should be linked to
        dashboardUid: my_dashboard
        # <int> ID of the panel that the alert rule should be linked to
        panelId: 123
        # <string> the state the alert rule will have when no data is returned
        #          possible values: "NoData", "Alerting", "OK", default = NoData
        noDataState: Alerting
        # <string> the state the alert rule will have when the query execution
        #          failed - possible values: "Error", "Alerting", "OK"
        #          default = Alerting
        execErrState: Alerting
        # <duration, required> for how long should the alert fire before alerting
        for: 60s
        # <map<string, string>> a map of strings to pass around any data
        annotations:
          some_key: some_value
        # <map<string, string> a map of strings that can be used to filter and
        #                      route alerts
        labels:
          team: sre_team_1
```

Here is an example of a configuration file for deleting alert rules.

```yaml
# config file version
apiVersion: 1

# List of alert rule UIDs that should be deleted
deleteRules:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> unique identifier for the rule
    uid: my_id_1
```

## Import contact points

Create or delete contact points using provisioning files in your Grafana instance(s).

1. Find the contact point in Grafana.
1. [Export](ref:export_contact_points) and download a provisioning file for your contact point.
1. Copy the contents into a YAML or JSON configuration file and add it to the `provisioning/alerting` directory of the Grafana instance you want to import the alerting resources to.

   Example configuration files can be found below.

1. Restart your Grafana instance (or reload the provisioned files using the Admin API).

Here is an example of a configuration file for creating contact points.

```yaml
# config file version
apiVersion: 1

# List of contact points to import or update
contactPoints:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the contact point
    name: cp_1
    receivers:
      # <string, required> unique identifier for the receiver. Should not exceed 40 symbols. Only letters, numbers, - (hyphen), and _ (underscore) allowed.
      - uid: first_uid
        # <string, required> type of the receiver
        type: prometheus-alertmanager
        # <bool, optional> Disable the additional [Incident Resolved] follow-up alert, default = false
        disableResolveMessage: false
        # <object, required> settings for the specific receiver type
        settings:
          url: http://test:9000
```

Here is an example of a configuration file for deleting contact points.

```yaml
# config file version
apiVersion: 1

# List of receivers that should be deleted
deleteContactPoints:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> unique identifier for the receiver
    uid: first_uid
```

### Settings

Here are some examples of settings you can use for the different
contact point integrations.

{{< collapse title="Alertmanager" >}}

#### Alertmanager

```yaml
type: prometheus-alertmanager
settings:
  # <string, required>
  url: http://localhost:9093
  # <string>
  basicAuthUser: abc
  # <string>
  basicAuthPassword: abc123
```

{{< /collapse >}}

{{< collapse title="DingDing" >}}

#### DingDing

```yaml
type: dingding
settings:
  # <string, required>
  url: https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx
  # <string> options: link, actionCard
  msgType: link
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Discord" >}}

#### Discord

```yaml
type: discord
settings:
  # <string, required>
  url: https://discord/webhook
  # <string>
  avatar_url: https://my_avatar
  # <bool>
  use_discord_username: false
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="E-Mail" >}}

#### E-Mail

```yaml
type: email
settings:
  # <string, required>
  addresses: me@example.com;you@example.com
  # <bool>
  singleEmail: false
  # <string>
  message: my optional message to include
  # <string>
  subject: |
    {{ template "default.title" . }}
```

{{< /collapse >}}

{{< collapse title="Google Chat" >}}

#### Google Chat

```yaml
type: googlechat
settings:
  # <string, required>
  url: https://google/webhook
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Kafka" >}}

#### Kafka

```yaml
type: kafka
settings:
  # <string, required>
  kafkaRestProxy: http://localhost:8082
  # <string, required>
  kafkaTopic: topic1
```

{{< /collapse >}}

{{< collapse title="LINE" >}}

#### LINE

```yaml
type: line
settings:
  # <string, required>
  token: xxx
```

{{< /collapse >}}

{{< collapse title="MQTT" >}}

#### MQTT

```yaml
type: mqtt
settings:
  # <string, required>
  brokerUrl: tcp://127.0.0.1:1883
  # <string>
  clientId: grafana
  # <string, required>
  topic: grafana/alerts
  # <string>
  messageFormat: json
  # <string>
  username: grafana
  # <string>
  password: password1
  # <string>
  qos: 0
  # <bool>
  retain: false
  # <map>
  tlsConfig:
    # <bool>
    insecureSkipVerify: false
    # <string>
    clientCertificate: certificate in PEM format
    # <string>
    clientKey: key in PEM format
    # <string>
    caCertificate: CA certificate in PEM format
```

{{< /collapse >}}

{{< collapse title="Microsoft Teams" >}}

#### Microsoft Teams

```yaml
type: teams
settings:
  # <string, required>
  url: https://ms_teams_url
  # <string>
  title: |
    {{ template "default.title" . }}
  # <string>
  sectiontitle: ''
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="OpsGenie" >}}

#### OpsGenie

```yaml
type: opsgenie
settings:
  # <string, required>
  apiKey: xxx
  # <string, required>
  apiUrl: https://api.opsgenie.com/v2/alerts
  # <string>
  message: |
    {{ template "default.title" . }}
  # <string>
  description: some descriptive description
  # <bool>
  autoClose: false
  # <bool>
  overridePriority: false
  # <string> options: tags, details, both
  sendTagsAs: both
```

{{< /collapse >}}

{{< collapse title="PagerDuty" >}}

#### PagerDuty

```yaml
type: pagerduty
settings:
  # <string, required> the 32-character Events API key https://support.pagerduty.com/docs/api-access-keys#events-api-keys
  integrationKey: XXX
  # <string> options: critical, error, warning, info
  severity: critical
  # <string>
  class: ping failure
  # <string>
  component: Grafana
  # <string>
  group: app-stack
  # <string>
  summary: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Pushover" >}}

#### Pushover

```yaml
type: pushover
settings:
  # <string, required>
  apiToken: XXX
  # <string, required>
  userKey: user1,user2
  # <string>
  device: device1,device2
  # <string> options (high to low): 2,1,0,-1,-2
  priority: '2'
  # <string>
  retry: '30'
  # <string>
  expire: '120'
  # <string> the number of seconds before a message expires and is deleted automatically. Examples: 10s, 5m30s, 8h.
  ttl:
  # <string>
  sound: siren
  # <string>
  okSound: magic
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Slack" >}}

#### Slack

```yaml
type: slack
settings:
  # <string, required>
  recipient: alerting-dev
  # <string, required>
  token: xxx
  # <string>
  username: grafana_bot
  # <string>
  icon_emoji: heart
  # <string>
  icon_url: https://icon_url
  # <string>
  mentionUsers: user_1,user_2
  # <string>
  mentionGroups: group_1,group_2
  # <string> options: here, channel
  mentionChannel: here
  # <string> Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary
  url: https://some_webhook_url
  # <string>
  endpointUrl: https://custom_url/api/chat.postMessage
  # <string>
  color: {{ if eq .Status "firing" }}#D63232{{ else }}#36a64f{{ end }}
  # <string>
  title: |
    {{ template "slack.default.title" . }}
  text: |
    {{ template "slack.default.text" . }}
```

{{< /collapse >}}

{{< collapse title="Sensu Go" >}}

#### Sensu Go

```yaml
type: sensugo
settings:
  # <string, required>
  url: http://sensu-api.local:8080
  # <string, required>
  apikey: xxx
  # <string>
  entity: default
  # <string>
  check: default
  # <string>
  handler: some_handler
  # <string>
  namespace: default
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Telegram" >}}

#### Telegram

```yaml
type: telegram
settings:
  # <string, required>
  bottoken: xxx
  # <string, required>
  chatid: some_chat_id
  # <string>
  message: |
    {{ template "default.message" . }}
```

{{< /collapse >}}

{{< collapse title="Threema Gateway" >}}

#### Threema Gateway

```yaml
type: threema
settings:
  # <string, required>
  api_secret: xxx
  # <string, required>
  gateway_id: A5K94S9
  # <string, required>
  recipient_id: A9R4KL4S
```

{{< /collapse >}}

{{< collapse title="VictorOps" >}}

#### VictorOps

```yaml
type: victorops
settings:
  # <string, required>
  url: XXX
  # <string> options: CRITICAL, WARNING
  messageType: CRITICAL
```

{{< /collapse >}}

{{< collapse title="Webhook" >}}

#### Webhook

```yaml
type: webhook
settings:
  # <string, required>
  url: https://endpoint_url
  # <string> options: POST, PUT
  httpMethod: POST
  # <string>
  username: abc
  # <string>
  password: abc123
  # <string>
  authorization_scheme: Bearer
  # <string>
  authorization_credentials: abc123
  # <string>
  maxAlerts: '10'
  # <map>
  tlsConfig:
    # <bool>
    insecureSkipVerify: false
    # <string>
    clientCertificate: certificate in PEM format
    # <string>
    clientKey: key in PEM format
    # <string>
    caCertificate: CA certificate in PEM format
```

{{< /collapse >}}

{{< collapse title="WeCom" >}}

#### WeCom

```yaml
type: wecom
settings:
  # <string, required>
  url: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx
  # <string>
  message: |
    {{ template "default.message" . }}
  # <string>
  title: |
    {{ template "default.title" . }}
```

{{< /collapse >}}

## Import notification template groups

Create or delete notification template groups using provisioning files in your Grafana instance(s).

1. Find the notification template group in Grafana.
1. [Export](ref:export_templates) a template group by copying the template content and name.
1. Copy the contents into a YAML or JSON configuration file and add it to the `provisioning/alerting` directory of the Grafana instance you want to import the alerting resources to.

   Example configuration files can be found below.

1. Restart your Grafana instance (or reload the provisioned files using the Admin API).

Here is an example of a configuration file for creating notification template groups.

```yaml
# config file version
apiVersion: 1

# List of templates to import or update
templates:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the template group, must be unique
    name: my_first_template
    # <string, required> content of the template group
    template: |
      {{ define "my_first_template" }}
        Custom notification message
      {{ end }}
```

Here is an example of a configuration file for deleting notification template groups.

```yaml
# config file version
apiVersion: 1

# List of alert rule UIDs that should be deleted
deleteTemplates:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the template group, must be unique
    name: my_first_template
```

## Import notification policies

Create or reset the notification policy tree using provisioning files in your Grafana instance(s).

In Grafana, the entire notification policy tree is considered a single, large resource. Add new specific policies as sub-policies under the root policy. Since specific policies may depend on each other, you cannot provision subsets of the policy tree; the entire tree must be defined in a single place.

{{% admonition type="warning" %}}

Since the policy tree is a single resource, provisioning it will overwrite a policy tree created through any other means.

{{< /admonition >}}

1. Find the notification policy tree in Grafana.
1. [Export](ref:export_policies) and download a provisioning file for your notification policy tree.
1. Copy the contents into a YAML or JSON configuration file and add it to the `provisioning/alerting` directory of the Grafana instance you want to import the alerting resources to.

   Example configuration files can be found below.

1. Restart your Grafana instance (or reload the provisioned files using the Admin API).

Here is an example of a configuration file for creating notification policies.

```yaml
# config file version
apiVersion: 1

# List of notification policies
policies:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string> name of the contact point that should be used for this route
    receiver: grafana-default-email
    # <list> The labels by which incoming alerts are grouped together. For example,
    #        multiple alerts coming in for cluster=A and alertname=LatencyHigh would
    #        be batched into a single group.
    #
    #        To aggregate by all possible labels use the special value '...' as
    #        the sole label name, for example:
    #        group_by: ['...']
    #        This effectively disables aggregation entirely, passing through all
    #        alerts as-is. This is unlikely to be what you want, unless you have
    #        a very low alert volume or your upstream notification system performs
    #        its own grouping.
    group_by: ['...']
    # <list> a list of prometheus-like matchers that an alert rule has to fulfill to match the node (allowed chars
    #        [a-zA-Z_:])
    matchers:
      - alertname = Watchdog
      - service_id_X = serviceX
      - severity =~ "warning|critical"
    # <list> a list of grafana-like matchers that an alert rule has to fulfill to match the node
    object_matchers:
      - ['alertname', '=', 'CPUUsage']
      - ['service_id-X', '=', 'serviceX']
      - ['severity', '=~', 'warning|critical']
    # <list> Times when the route should be muted. These must match the name of a
    #        mute time interval.
    #        Additionally, the root node cannot have any mute times.
    #        When a route is muted it will not send any notifications, but
    #        otherwise acts normally (including ending the route-matching process
    #        if the `continue` option is not set)
    mute_time_intervals:
      - abc
    # <duration> How long to initially wait to send a notification for a group
    #            of alerts. Allows to collect more initial alerts for the same group.
    #            (Usually ~0s to few minutes), default = 30s
    group_wait: 30s
    # <duration> How long to wait before sending a notification about new alerts that
    #            are added to a group of alerts for which an initial notification has
    #            already been sent. (Usually ~5m or more), default = 5m
    group_interval: 5m
    # <duration>  How long to wait before sending a notification again if it has already
    #             been sent successfully for an alert. (Usually ~3h or more), default = 4h
    repeat_interval: 4h
    # <list> Zero or more child policies. The schema is the same as the root policy.
    # routes:
    #   # Another recursively nested policy...
    #   - receiver: another-receiver
    #     matchers:
    #       - ...
    #     ...
```

Here is an example of a configuration file for resetting the policy tree back to its default value:

```yaml
# config file version
apiVersion: 1

# List of orgIds that should be reset to the default policy
resetPolicies:
  - 1
```

## Import mute timings

Create or delete mute timings via provisioning files using provisioning files in your Grafana instance(s).

1. Find the mute timing in Grafana.
1. [Export](ref:export_mute_timings) and download a provisioning file for your mute timing.
1. Copy the contents into a YAML or JSON configuration file and add it to the `provisioning/alerting` directory of the Grafana instance you want to import the alerting resources to.

   Example configuration files can be found below.

1. Restart your Grafana instance (or reload the provisioned files using the Admin API).

Here is an example of a configuration file for creating mute timings.

```yaml
# config file version
apiVersion: 1

# List of mute time intervals to import or update
muteTimes:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the mute time interval, must be unique
    name: mti_1
    # <list> time intervals that should trigger the muting
    #        refer to https://prometheus.io/docs/alerting/latest/configuration/#time_interval-0
    time_intervals:
      - times:
          - start_time: '06:00'
            end_time: '23:59'
        location: 'UTC'
        weekdays: ['monday:wednesday', 'saturday', 'sunday']
        months: ['1:3', 'may:august', 'december']
        years: ['2020:2022', '2030']
        days_of_month: ['1:5', '-3:-1']
```

Here is an example of a configuration file for deleting mute timings.

```yaml
# config file version
apiVersion: 1

# List of mute time intervals that should be deleted
deleteMuteTimes:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the mute time interval, must be unique
    name: mti_1
```

## Template variable interpolation

Provisioning interpolates environment variables using the `$variable` syntax.

```yaml
contactPoints:
  - orgId: 1
    name: My Contact Email Point
    receivers:
      - uid: 1
        type: email
        settings:
          addresses: $EMAIL
```

In this example, provisioning replaces `$EMAIL` with the value of the `EMAIL` environment variable or an empty string if it is not present. For more information, refer to [Using environment variables in the Provision documentation](ref:provisioning_env_vars).

In alerting resources, most properties support template variable interpolation, with a few exceptions:

- Alert rule annotations: `groups[].rules[].annotations`
- Alert rule time range: `groups[].rules[].relativeTimeRange`
- Alert rule query model: `groups[].rules[].data.model`
- Mute timings name: `muteTimes[].name`
- Mute timings time intervals: `muteTimes[].time_intervals[]`
- Notification template group name: `templates[].name`
- Notification template group content: `templates[].template`

Note for properties that support interpolation, you may unexpectedly substitute template variables when not intended. To avoid this, you can escape the `$variable` with `$$variable`.

For example, when provisioning a `subject` property in a `contactPoints.receivers.settings` object that is meant to use the `$labels` variable.

1. `subject: '{{ $labels }}'` will interpolate, incorrectly defining the subject as `subject: '{{ }}'`.
1. `subject: '{{ $$labels }}'` will not interpolate, correctly defining the subject as `subject: '{{ $labels }}'`.

## More examples

For more examples on the concept of this guide:

- Try provisioning alerting resources in Grafana OSS with YAML files through a demo project using [Docker Compose](https://github.com/grafana/provisioning-alerting-examples/tree/main/config-files) or [Kubernetes deployments](https://github.com/grafana/provisioning-alerting-examples/tree/main/kubernetes).
- Review the distinct options about how Grafana provisions resources in the [Provision Grafana documentation](ref:provisioning).
- For Helm support, review the examples provisioning alerting resources in the [Grafana Helm Chart documentation](https://github.com/grafana/helm-charts/blob/main/charts/grafana/README.md).
