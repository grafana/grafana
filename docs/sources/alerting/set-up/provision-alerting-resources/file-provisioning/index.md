---
aliases:
  - ../../provision-alerting-resources/file-provisioning/
description: Create and manage resources using file provisioning
keywords:
  - grafana
  - alerting
  - alerting resources
  - file provisioning
  - provisioning
title: Create and manage alerting resources using file provisioning
weight: 100
---

## Create and manage alerting resources using file provisioning

Provision your alerting resources using files from disk. When you start Grafana, the data from these files is created in your Grafana system. Grafana adds any new resources you created, updates any that you changed, and deletes old ones.

Arrange your files in a directory in a way that best suits your use case. For example, you can choose a team-based layout where every team has its own file, you can have one big file for all your teams; or you can have one file per resource type.

Details on how to set up the files and which fields are required for each object are listed below depending on which resource you are provisioning.

**Note:**

Provisioning takes place during the initial set up of your Grafana system, but you can re-run it at any time using the [Grafana Admin API](https://grafana.com/docs/grafana/latest/developers/http_api/admin/#reload-provisioning-configurations).

### Provision alert rules

Create or delete alert rules in your Grafana instance(s).

1. Create alert rules in Grafana.
1. Use the [Alerting provisioning API](https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/#route-get-alert-rule-export) export endpoints to download a provisioning file for your alert rules.
1. Copy the contents into a YAML or JSON configuration file in the default provisioning directory or in your configured directory.
   Example: <grafana_install_dir>/provisioning/alerting

   Example configuration files can be found below.

1. Ensure that your files are in the right directory on the node running the Grafana server, so that they deploy alongside your Grafana instance(s).
1. Delete the alert rules in Grafana that will be provisioned.

   **Note:**

   If you do not delete the alert rule, it will clash with the provisioned alert rule once uploaded.

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
      # <string, required> unique identifier for the rule
      - uid: my_id_1
        # <string, required> title of the rule that will be displayed in the UI
        title: my_first_rule
        # <string, required> which query should be used for the condition
        condition: A
        # <list, required> list of query objects that should be executed on each
        #                  evaluation - should be obtained trough the API
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

### Provision contact points

Create or delete contact points in your Grafana instance(s).

1. Create a YAML or JSON configuration file.

   Example configuration files can be found below.

1. Add the file(s) to your GitOps workflow, so that they deploy alongside your Grafana instance(s).

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
      # <string, required> unique identifier for the receiver
      - uid: first_uid
        # <string, required> type of the receiver
        type: prometheus-alertmanager
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

#### Settings

Here are some examples of settings you can use for the different
contact point integrations.

##### Alertmanager

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

##### DingDing

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

##### Discord

```yaml
type: discord
settings:
  # <string, required>
  url: https://discord/webhook
  # <string>
  avatar_url: https://my_avatar
  # <string>
  use_discord_username: Grafana
  # <string>
  message: |
    {{ template "default.message" . }}
```

##### E-Mail

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

##### Google Hangouts Chat

```yaml
type: googlechat
settings:
  # <string, required>
  url: https://google/webhook
  # <string>
  message: |
    {{ template "default.message" . }}
```

##### Kafka

```yaml
type: kafka
settings:
  # <string, required>
  kafkaRestProxy: http://localhost:8082
  # <string, required>
  kafkaTopic: topic1
```

##### LINE

```yaml
type: line
settings:
  # <string, required>
  token: xxx
```

##### Microsoft Teams

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

##### OpsGenie

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

##### PagerDuty

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

##### Pushover

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
  # <string>
  sound: siren
  # <string>
  okSound: magic
  # <string>
  message: |
    {{ template "default.message" . }}
```

##### Slack

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
  title: |
    {{ template "slack.default.title" . }}
  text: |
    {{ template "slack.default.text" . }}
```

##### Sensu Go

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

##### Telegram

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

##### Threema Gateway

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

##### VictorOps

```yaml
type: victorops
settings:
  # <string, required>
  url: XXX
  # <string> options: CRITICAL, WARNING
  messageType: CRITICAL
```

##### Webhook

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
```

##### WeCom

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

### Provision notification policies

Create or reset notification policies in your Grafana instance(s).

1. Create a YAML or JSON configuration file.

   Example configuration files can be found below.

2. Add the file(s) to your GitOps workflow, so that they deploy alongside your Grafana instance(s).

Here is an example of a configuration file for creating notification policiies.

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
    # <list> Zero or more child routes
    # routes:
    # ...
```

Here is an example of a configuration file for resetting notification policies.

```yaml
# config file version
apiVersion: 1

# List of orgIds that should be reset to the default policy
resetPolicies:
  - 1
```

### Provision templates

Create or delete templates in your Grafana instance(s).

1. Create a YAML or JSON configuration file.

   Example configuration files can be found below.

2. Add the file(s) to your GitOps workflow, so that they deploy alongside your Grafana instance(s).

Here is an example of a configuration file for creating templates.

```yaml
# config file version
apiVersion: 1

# List of templates to import or update
templates:
  # <int> organization ID, default = 1
  - orgID: 1
    # <string, required> name of the template, must be unique
    name: my_first_template
    # <string, required> content of the the template
    template: Alerting with a custom text template
```

Here is an example of a configuration file for deleting templates.

```yaml
# config file version
apiVersion: 1

# List of alert rule UIDs that should be deleted
deleteTemplates:
  # <int> organization ID, default = 1
  - orgId: 1
    # <string, required> name of the template, must be unique
    name: my_first_template
```

### Provision mute timings

Create or delete mute timings in your Grafana instance(s).

1. Create a YAML or JSON configuration file.

   Example configuration files can be found below.

1. Add the file(s) to your GitOps workflow, so that they deploy alongside your Grafana instance(s).

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

### File provisioning using Kubernetes

If you are a Kubernetes user, you can leverage file provisioning using Kubernetes configuration maps.

1. Create one or more configuration maps as follows.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-alerting
data:
  provisioning.yaml: |
    templates:
    - name: my_first_template
      template: the content for my template
```

2. Add the file(s) to your GitOps workflow, so that they deploy alongside your Grafana instance(s).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      name: grafana
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports:
            - name: grafana
              containerPort: 3000
          volumeMounts:
            - mountPath: /etc/grafana/provisioning/alerting
              name: grafana-alerting
              readOnly: false
      volumes:
        - name: grafana-alerting
          configMap:
            defaultMode: 420
            name: grafana-alerting
```

This eliminates the need for a persistent database to use Grafana Alerting in Kubernetes; all your provisioned resources appear after each restart or re-deployment.
