---
aliases:
  - ../../../fundamentals/contact-points/notifiers/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/notifiers/webhook-notifier/
  - ../../../fundamentals/contact-points/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/webhook-notifier/
  - ../../../manage-notifications/manage-contact-points/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/manage-contact-points/webhook-notifier/
  - alerting/manage-notifications/manage-contact-points/webhook-notifier/
  - ../../../alerting-rules/manage-contact-points/integrations/webhook-notifier/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/integrations/webhook-notifier/

canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
description: Configure the webhook notifier integration for Alerting
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Webhook
title: Configure the webhook notifier for Alerting
weight: 165
refs:
  notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  notification-templates-namespaced-functions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#namespaced-functions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#namespaced-functions
---

# Configure webhook notifications

Use the webhook integration in contact points to send alert notifications to your webhook.

The webhook integration is a flexible way to integrate alerts into your system. When a notification is triggered, it sends a JSON request with alert details and additional data to the webhook endpoint.

## Configure webhook for a contact point

To create a contact point with webhook integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **Webhook**.
1. In the **URL** field, copy in your Webhook URL.
1. (Optional) Configure [additional settings](#webhook-settings).
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

## Webhook settings

| Option | Description      |
| ------ | ---------------- |
| URL    | The Webhook URL. |

#### Optional settings

| Option                            | Description                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP Method                       | Specifies the HTTP method to use: `POST` or `PUT`.                                                                                                                                        |
| Basic Authentication Username     | Username for HTTP Basic Authentication.                                                                                                                                                   |
| Basic Authentication Password     | Password for HTTP Basic Authentication.                                                                                                                                                   |
| Authentication Header Scheme      | Scheme for the `Authorization` Request Header. Default is `Bearer`.                                                                                                                       |
| Authentication Header Credentials | Credentials for the `Authorization` Request header.                                                                                                                                       |
| Extra Headers                     | Additional HTTP headers to include in the request. You can also override the default `Content-Type: application/json` header to specify a different content type for the request payload. |
| Max Alerts                        | Maximum number of alerts to include in a notification. Any alerts exceeding this limit are ignored. `0` means no limit.                                                                   |
| TLS                               | TLS configuration options, including CA certificate, client certificate, and client key.                                                                                                  |
| HMAC Signature                    | HMAC signature configuration options.                                                                                                                                                     |
| HTTP Config                       | Configure an OAuth2 endpoint for alert notifications                                                                                                                                      |

{{< admonition type="note" >}}

You can configure either HTTP Basic Authentication or the Authorization request header, but not both.

{{< /admonition >}}

#### HMAC signature

You can secure your webhook notifications using HMAC signatures to verify the authenticity and integrity of the requests. When enabled, Grafana signs the webhook payload with a shared secret using HMAC-SHA256.

| Option           | Description                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secret           | The shared secret key used to generate the HMAC signature.                                                                                                                                                                     |
| Header           | The HTTP header where the signature will be set. Default is `X-Grafana-Alerting-Signature`.                                                                                                                                    |
| Timestamp Header | Optional header to include a timestamp in the signature calculation. When specified, Grafana will set a Unix timestamp in this header and include it in the HMAC calculation. This provides protection against replay attacks. |

When HMAC signing is configured, Grafana generates a signature using HMAC-SHA256 with your secret key. If a timestamp header is specified, a Unix timestamp is included in the signature calculation. The signature is calculated as:

```
HMAC(timestamp + ":" + body)
```

The timestamp is sent in the specified header. If no timestamp header is specified, the signature is calculated just from the request body. The signature is sent as a hex-encoded string in the specified signature header.

##### Validate a request

To validate incoming webhook requests from Grafana, follow these steps:

1. Extract the signature from the header (default is `X-Grafana-Alerting-Signature`).
2. If you configured a timestamp header, extract the timestamp value and verify it's recent to prevent replay attacks.
3. Calculate the expected signature:
   - Create an HMAC-SHA256 hash using your shared secret
   - If using timestamps, include the timestamp followed by a colon (`:`) before the request body
   - Hash the raw request body
   - Convert the result to a hexadecimal string
4. Compare the calculated signature with the one in the request header.

#### Optional settings using templates

Use the following settings to include custom data within the [JSON payload](#body). Both options support using [notification templates](ref:notification-templates).

| Option                            | Description                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                             | Sends the value as a string in the `title` field of the [JSON payload](#body). Supports [notification templates](ref:notification-templates).   |
| Message                           | Sends the value as a string in the `message` field of the [JSON payload](#body). Supports [notification templates](ref:notification-templates). |
| [Custom Payload](#custom-payload) | Optionally override the default payload format with a custom template.                                                                          |

#### Optional notification settings

| Option                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Disable resolved message | Enable this option to prevent notifications when an alert resolves. |

## Default JSON payload

The following example shows the payload of a webhook notification containing information about two firing alerts:

```json
{
  "receiver": "My Super Webhook",
  "status": "firing",
  "orgId": 1,
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "High memory usage",
        "team": "blue",
        "zone": "us-1"
      },
      "annotations": {
        "description": "The system has high memory usage",
        "runbook_url": "https://myrunbook.com/runbook/1234",
        "summary": "This alert was triggered for zone us-1"
      },
      "startsAt": "2021-10-12T09:51:03.157076+02:00",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://play.grafana.org/alerting/1afz29v7z/edit",
      "fingerprint": "c6eadffa33fcdf37",
      "silenceURL": "https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1",
      "dashboardURL": "",
      "panelURL": "",
      "values": {
        "B": 44.23943737541908,
        "C": 1
      }
    },
    {
      "status": "firing",
      "labels": {
        "alertname": "High CPU usage",
        "team": "blue",
        "zone": "eu-1"
      },
      "annotations": {
        "description": "The system has high CPU usage",
        "runbook_url": "https://myrunbook.com/runbook/1234",
        "summary": "This alert was triggered for zone eu-1"
      },
      "startsAt": "2021-10-12T09:56:03.157076+02:00",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://play.grafana.org/alerting/d1rdpdv7k/edit",
      "fingerprint": "bc97ff14869b13e3",
      "silenceURL": "https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1",
      "dashboardURL": "",
      "panelURL": "",
      "values": {
        "B": 44.23943737541908,
        "C": 1
      }
    }
  ],
  "groupLabels": {},
  "commonLabels": {
    "team": "blue"
  },
  "commonAnnotations": {},
  "externalURL": "https://play.grafana.org/",
  "version": "1",
  "groupKey": "{}:{}",
  "truncatedAlerts": 0,
  "title": "[FIRING:2]  (blue)",
  "state": "alerting",
  "message": "**Firing**\n\nLabels:\n - alertname = T2\n - team = blue\n - zone = us-1\nAnnotations:\n - description = This is the alert rule checking the second system\n - runbook_url = https://myrunbook.com\n - summary = This is my summary\nSource: https://play.grafana.org/alerting/1afz29v7z/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT2%2Cteam%3Dblue%2Czone%3Dus-1\n\nLabels:\n - alertname = T1\n - team = blue\n - zone = eu-1\nAnnotations:\nSource: https://play.grafana.org/alerting/d1rdpdv7k/edit\nSilence: https://play.grafana.org/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DT1%2Cteam%3Dblue%2Czone%3Deu-1\n"
}
```

### Body

The JSON payload of webhook notifications includes the following key-value pairs:

| Key                 | Type                      | Description                                                                      |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `receiver`          | string                    | Name of the contact point.                                                       |
| `status`            | string                    | Current status of the alert, `firing` or `resolved`.                             |
| `orgId`             | number                    | ID of the organization related to the payload.                                   |
| `alerts`            | array of [alerts](#alert) | Alerts that are triggering.                                                      |
| `groupLabels`       | object                    | Labels that are used for grouping, map of string keys to string values.          |
| `commonLabels`      | object                    | Labels that all alarms have in common, map of string keys to string values.      |
| `commonAnnotations` | object                    | Annotations that all alarms have in common, map of string keys to string values. |
| `externalURL`       | string                    | External URL to the Grafana instance sending this webhook.                       |
| `version`           | string                    | Version of the payload structure.                                                |
| `groupKey`          | string                    | Key that is used for grouping.                                                   |
| `truncatedAlerts`   | number                    | Number of alerts that were truncated.                                            |
| `state`             | string                    | State of the alert group (either `alerting` or `ok`).                            |

The following key-value pairs are also included in the JSON payload and can be configured in the [webhook settings using notification templates](#optional-settings-using-templates).

| Key       | Type   | Description                                                                                                          |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `title`   | string | Custom title. Configurable in [webhook settings using notification templates](#optional-settings-using-templates).   |
| `message` | string | Custom message. Configurable in [webhook settings using notification templates](#optional-settings-using-templates). |

### Alert

The Alert object represents an alert included in the notification group, as provided by the [`alerts` field](#body).

{{< docs/shared lookup="alerts/table-for-json-alert-object.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Custom Payload

{{< admonition type="note" >}}

Custom Payload is not yet [generally available](https://grafana.com/docs/release-life-cycle/#general-availability) in Grafana Cloud.

{{< /admonition >}}

The `Custom Payload` option allows you to completely customize the webhook payload using templates. This gives you full control over the structure and content of the webhook request.

| Option            | Description                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Payload Template  | Template string that defines the structure of the webhook payload.                                        |
| Payload Variables | Key-value pairs that define additional variables available in the template under `.Vars.<variable_name>`. |

Example of a custom payload template that includes variables:

```
{
  "alert_name": "{{ .CommonLabels.alertname }}",
  "status": "{{ .Status }}",
  "environment": "{{ .Vars.environment }}",
  "custom_field": "{{ .Vars.custom_field }}"
}
```

{{< admonition type="note" >}}
When using Custom Payload, the Title and Message fields are ignored as the entire payload structure is determined by your template.
{{< /admonition >}}

### JSON Template Functions

When creating custom payloads, several template functions are available to help generate valid JSON structures. These include functions for creating dictionaries (`coll.Dict`), arrays (`coll.Slice`, `coll.Append`), and converting between JSON strings and objects (`data.ToJSON`, `data.JSON`).

For detailed information about these and other template functions, refer to [notification template functions](ref:notification-templates-namespaced-functions).

Example using JSON helper functions:

{{< docs/shared lookup="alerts/example-custom-json-payload.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### OAuth2 configuration

The HTTP client configurations supports OAuth 2.0 authentication using the `client_credentials` grant type. Alertmanager fetches an access token from the specified endpoint with the given client access and secret keys.

| Option              | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Token URL           | URL for the access token endpoint.                                                                      |
| Client ID           | Client ID to use when authenticating.                                                                   |
| Client Secret       | Client secret to use when authenticating.                                                               |
| Scopes              | Optional scopes to request when obtaining an access token.                                              |
| Endpoint Parameters | Optional parameters to append to the access token request.                                              |
| TLS                 | Optional TLS configuration options to certify (or disable certification) for OAuth2 requests.           |
| Proxy Config        | Optional configuration to designate proxy servers and custom headers for proxy server connect requests. |
