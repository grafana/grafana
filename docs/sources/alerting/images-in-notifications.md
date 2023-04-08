---
description:
keywords:
  - grafana
  - alerting
  - images
  - notifications
title: Use images in notifications
weight: 460
---

# Use images in notifications

Images in notifications helps recipients of alert notifications better understand why an alert has fired or resolved by including a screenshot of the panel associated with the alert.

> **Note**: This feature is not supported for Mimir or Loki rules, or when Grafana sends alert notifications to an external Alertmanager.

When an alert is fired or resolved Grafana takes a screenshot of the panel associated with the alert. This is determined via the Dashboard UID and Panel ID annotations of the rule. Grafana cannot take a screenshot for alerts that are not associated with a panel.

Because a number of contact points, such as email, do not support uploading screenshots at the time of sending a notification; Grafana can also upload the screenshot to a cloud storage service such as Amazon S3, Azure Blob Storage and Google Cloud Storage, where a link to the uploaded screenshot can be added to the notification. However, if using a cloud storage service is not an option then Grafana can be its own cloud storage service such that the screenshot is available under the same domain as Grafana.

Should either the cloud storage service, or Grafana if acting as its own cloud storage service, be protected by a firewall, gateway service or VPN, then screenshots might not be shown in notifications.

How to choose between uploading screenshots at the time of sending the notification, using a cloud storage service, or using Grafana as its own cloud storage service, depends on which contact points you plan to use and whether you use a firewall, gateway service or VPN.

For example, if a contact point supports uploading images at the time of notification is it not required to use cloud storage. Cloud storage is required when a contact point does not support uploading images at the time of sending a notification, such as email. We don't recommend using cloud storage if the cloud storage service is behind a firewall, gateway service, or VPN, as screenshots might not be shown in notifications.

Please refer to the table at the end of this page for a list of contact points and their support for images in notifications.

## Requirements

To use images in notifications, Grafana must be set up to use [image rendering](https://grafana.com/docs/grafana/next/setup-grafana/image-rendering/). You can either install the image rendering plugin or run it as a remote rendering service.

When a screenshot is taken it is saved to the [data]({{< relref "../setup-grafana/configure-grafana#paths" >}}) path. This is where screenshots are stored before being sent in a notification or uploaded to a cloud storage service. Grafana must have write-access to this path. If Grafana cannot write to this path then screenshots cannot be saved to disk and an error will be logged for each failed screenshot attempt.

If using a [cloud storage service]({{< relref "../setup-grafana/configure-grafana#external_image_storage" >}}) such as Amazon S3, Azure Blob Storage or Google Cloud Storage, uploaded images need to be accessible outside of a firewall, gateway service or VPN for screenshots to be shown in notifications. Grafana will not delete screenshots from cloud storage. We recommend configuring a retention policy on the bucket to delete screenshots older than 1 month.

If using Grafana as its own cloud storage service then screenshots will be saved to `static_root_path/img/attachments`. `static_root_path` is a configuration option for Grafana and can be found in `defaults.ini`. However, like when using a cloud storage service, images need to be accessible outside of a firewall, gateway service or VPN for screenshots to be shown in notifications.

When using Grafana as its own cloud storage service screenshots are copied from [data]({{< relref "../setup-grafana/configure-grafana#paths" >}}) to `static_root_path/img/attachments`. Screenshots older than `temp_data_lifetime` are deleted from [data]({{< relref "../setup-grafana/configure-grafana#paths" >}}) but not from `static_root_path/images/attachments`. To delete screenshots from `static_root_path` after a certain amount of time we recommend setting up a CRON job.

## Configuration

Having installed either the image rendering plugin, or set up Grafana to use a remote rendering service, set `capture` in `[unified_alerting.screenshots]` to `true`:

    # Enable screenshots in notifications. This option requires the Grafana Image Renderer plugin.
    # For more information on configuration options, refer to [rendering].
    capture = false

If screenshots should be uploaded to cloud storage then `upload_external_image_storage` should also be set to `true`:

    # Uploads screenshots to the local Grafana server or remote storage such as Azure, S3 and GCS. Please
    # see [external_image_storage] for further configuration options. If this option is false, screenshots
    # will be persisted to disk for up to temp_data_lifetime.
    upload_external_image_storage = false

Please see [`[external_image_storage]`](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#external_image_storage) for instructions on how to configure cloud storage. Grafana will not start if `upload_external_image_storage` is `true` and `[external_image_storage]` contains missing or invalid configuration.

If Grafana is acting as its own cloud storage then `[upload_external_image_storage]` should be set to `true` and the `local` provider should be set in [`[external_image_storage]`](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#external_image_storage).

Restart Grafana for the changes to take effect.

## Advanced configuration

We recommended that `max_concurrent_screenshots` is less than or equal to `concurrent_render_request_limit`. The default value for both `max_concurrent_screenshots` and `concurrent_render_request_limit` is `5`:

    # The maximum number of screenshots that can be taken at the same time. This option is different from
    # concurrent_render_request_limit as max_concurrent_screenshots sets the number of concurrent screenshots
    # that can be taken at the same time for all firing alerts where as concurrent_render_request_limit sets
    # the total number of concurrent screenshots across all Grafana services.
    max_concurrent_screenshots = 5

## Support for images in contact points

Grafana supports a wide range of contact points with varied support for images in notifications. The table below shows the list of all contact points supported in Grafana and their support for uploading images at the time of sending the notification and images uploaded to cloud storage, including when Grafana is acting as its own cloud storage service.

| Name                    | Upload image at time of notification | Cloud storage |
| ----------------------- | ------------------------------------ | ------------- |
| DingDing                | No                                   | No            |
| Discord                 | Yes                                  | Yes           |
| Email                   | Yes                                  | Yes           |
| Google Hangouts Chat    | No                                   | Yes           |
| Kafka                   | No                                   | No            |
| Line                    | No                                   | No            |
| Microsoft Teams         | No                                   | Yes           |
| Opsgenie                | No                                   | Yes           |
| Pagerduty               | No                                   | Yes           |
| Prometheus Alertmanager | No                                   | No            |
| Pushover                | Yes                                  | No            |
| Sensu Go                | No                                   | No            |
| Slack                   | No (will be available in 9.4)        | Yes           |
| Telegram                | Yes                                  | No            |
| Threema                 | No                                   | No            |
| VictorOps               | No                                   | No            |
| Webhook                 | No                                   | Yes           |
| Cisco Webex Teams       | No                                   | Yes           |

## Limitations

- This feature is not supported for Mimir or Loki rules, or when Grafana sends alert notifications to an external Alertmanager.
- When multiple alerts are sent in a single notification a screenshot might be included for each alert. The order the images are shown in random.
- Some contact points support at most one image per notification. In this case, the first image associated with an alert will be attached.
- We don't recommend using cloud storage if the cloud storage service is behind a firewall, gateway service, or VPN, as screenshots might not be shown in notifications.

## Troubleshooting

If Grafana has been set up to send images in notifications, however notifications are still being received without them, follow the troubleshooting steps below:

1. Check that images in notifications has been set up as per the instructions.
2. Enable debug logging in Grafana and look for logs with the logger `ngalert.image`.
3. If the alert is not associated with a dashboard there will be logs for `Cannot take screenshot for alert rule as it is not associated with a dashboard`.
4. If the alert is associated with a dashboard, but no panel in the dashboard, there will be logs for `Cannot take screenshot for alert rule as it is not associated with a panel`.
5. If images cannot be taken because of mis-configuration or an issue with image rendering there will be logs for `Failed to take an image` including the Dashboard UID, Panel ID, and the error message.
6. Check that the contact point supports images in notifications, and the present configuration, as per the table.
7. If the image was uploaded to cloud storage make sure it is public.
8. If images are made available via Grafana's built in web server make sure it is accessible via the Internet.

## Metrics

Grafana provides the following metrics to observe the performance and failure rate of images in notifications.
For example, if a screenshot could not be taken within the expected time (10 seconds) then the counter `grafana_screenshot_failures_total` is updated.

- `grafana_alerting_image_cache_hits_total`
- `grafana_alerting_image_cache_misses_total`
- `grafana_screenshot_duration_seconds`
- `grafana_screenshot_failures_total`
- `grafana_screenshot_successes_total`
- `grafana_screenshot_upload_failures_total`
- `grafana_screenshot_upload_successes_total`
