---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-jira/
description: Configure the Jira integration to receive notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - Jira
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Jira
title: Configure Jira for Alerting
weight: 121
refs:
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/
  custom-payload-webhook:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/#custom-payload
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/#custom-payload
---

# Configure Jira for Alerting

Use the Jira integration in a contact point to create issues in your Jira instance when alerts fire. The integration supports both Jira Cloud and Jira Server/Data Center installations.

## Before you begin

Before you begin, ensure you have the following:

- A Jira instance (Cloud, Server, or Data Center)
- API access credentials for Jira
- Appropriate permissions to create issues in your target Jira project

## Configure Jira for a contact point

To create a contact point with a Jira integration, complete the following steps:

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Notification configuration**, then select the **Contact points** tab.
2. Click **+ Add contact point**.
3. Enter a name for the contact point.
4. From the **Integration** list, select **Jira**.
5. Set up the required [settings](#required-settings) for your Jira configuration.
6. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

### Required Settings

| Key                 | Description                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL                 | The URL of the REST API of your Jira instance. Supported versions: `2` and `3` (e.g., `https://your-domain.atlassian.net/rest/api/3`). This field is [protected](ref:configure-contact-points) from modification in Grafana Cloud.     |
| Basic Auth User     | Username for authentication. For Jira Cloud, use your email address.                                                                                                                                                                   |
| Basic Auth Password | Password or personal token. For Jira Cloud, you need to obtain a personal token [here](https://id.atlassian.com/manage-profile/security/api-tokens) and use it as the password.                                                        |
| API Token           | An alternative to basic authentication, a bearer token is used to authorize the API requests. See [Jira documentation](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) for more information. |
| Project Key         | The project key identifying the project where issues will be created. Project keys are unique identifiers for a project.                                                                                                               |
| Issue Type          | The type of issue to create (e.g., `Task`, `Bug`, `Incident`). Make sure that you specify a type that is available in your project.                                                                                                    |

### Optional Settings

| Key                     | Description                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary                 | The issue title. Supports templating. Max length is 255 characters.                                                                                                                                                                                                                                                   |
| Description             | The description of the issue. Depending on version of the API, it can be a text, Markdown, or JSON (v3 API only). Maximum size of the field is 32kb.<br>**Note:** JSON is not limited by the client, and if it exceeds the size, the API is likely to reject the request.                                             |
| Labels                  | Custom labels can be added to organize and filter issues created in Jira. Supports templating, allowing dynamic label generation based on alert data.                                                                                                                                                                 |
| Priority                | The priority level of the issue (e.g., `Low`, `Medium`, `High`, `Critical`). <br>Ensure that the priority value matches the available options for your Jira instance. You can customize priority levels in Jira [here](https://support.atlassian.com/jira-cloud-administration/docs/configure-priorities/).           |
| Resolve Transition      | The transition name to move the issue to a resolved state when an alert is resolved. Ensure that the value matches a valid transition available in your Jira workflow for the specified issue type. If this field is empty, the issue will not be transitioned to Done.                                               |
| Reopen Transition       | The transition name to move the issue back to an open state when an alert reoccurs. Ensure that the value matches a valid transition available in your Jira workflow for the specified issue type. If this field is empty, the issue will not be reopened.                                                            |
| Reopen Duration         | The time duration (in minutes) to control whether to reopen an issue that was closed within this duration or create a new one. If not specified, the most recent issue that matches the deduplication key will be updated and reopened (if reopen transition is specified).                                           |
| "Won't fix" Transition  | Specify a resolution status that should be ignored when searching for existing issues. For example, issues with this resolution will not be reopened or updated by subsequent alerts.                                                                                                                                 |
| Deduplication Key Field | Custom field to store the deduplication key. Must be a text field. <br> If not specified, the deduplication key is added to labels in the format of `ALERT(hash sum)`. See [Jira documentation](https://support.atlassian.com/jira-cloud-administration/docs/create-a-custom-field/) for how to create custom fields. |
| Fields                  | Extra Jira issue fields, including standard and custom fields. For custom fields, use `customfield_<FIELD_ID>`, where `<FIELD_ID>` is the numeric field ID in your Jira instance. For JSON parsing and templating behavior, refer to [Custom field data](#custom-field-data).                                         |

### Custom field data

Grafana attempts to parse each string field value as JSON when it loads the contact point. Grafana sends values parsed as objects or arrays as structured JSON, such as `{"value": "High"}`, but doesn't evaluate templates inside them. Grafana evaluates values that remain strings as notification templates, but doesn't parse their rendered output as JSON. Templates therefore can't generate dynamic object or array field values, such as those required by Jira select-list fields.

To set different structured values for different alerts, create a Jira contact point for each static value and route alerts with [notification policies](ref:notification-policies). Or use a [Webhook contact point with a custom payload](ref:custom-payload-webhook) to send structured JSON that includes alert data.
