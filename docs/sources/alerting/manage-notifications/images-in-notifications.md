---
description:
keywords:
  - grafana
  - alerting
  - images
  - notifications
title: Use images in notifications
weight: 500
---

# Use images in notifications

Images in notifications helps recipients of alert notifications better understand why an alert has fired or resolved by including a screenshot of the panel associated with the alert.

> **Note**: This feature is not supported in Mimir or Loki, or when Grafana is configured to send alerts to other Alertmanagers such as the Prometheus Alertmanager

When an alert is fired or resolved Grafana takes a screenshot of the panel associated with the alert. This is determined via the Dashboard UID and Panel ID annotations of the rule. Grafana cannot take a screenshot for alerts that are not associated with a panel.

Grafana takes at most two screenshots for each alert: once when the alert fires and again when the alert is resolved. Screenshots are not re-taken over the lifetime of the alert, instead you should open the panel in Grafana to follow the data in real time. In addition, depending on how alerts are grouped in your notification policies, Grafana might send a notification with many screenshots of the same panel. This happens because Grafana does not know how your alerts are grouped at the time a screenshot is taken, and so acts conservatively by taking a screenshot for every alert.

Once a screenshot has been taken Grafana can either upload it to a cloud storage service such as Amazon S3, Azure Blob Storage or Google Cloud Storage; upload the screenshot to it's internal web server; or upload it to the service that is receiving the notification, such as Slack. Which option you should choose depends on how your Grafana is managed and which integrations you use. More information on this can be found in Requirements.

Refer to the table at the end of this page for a list of contact points and their support for images in notifications.

## Requirements

1. To use images in notifications, Grafana must be set up to use [image rendering]({{< relref "/docs/grafana/latest/setup-grafana/image-rendering" >}}). You can either install the image rendering plugin or run it as a remote rendering service.

2. When a screenshot is taken it is saved to the [data]({{< relref "/docs/grafana/latest/setup-grafana/configure-grafana#paths" >}}) folder, even if Grafana is configured to upload screenshots to a cloud storage service. Grafana must have write-access to this folder otherwise screenshots cannot be saved to disk and an error will be logged for each failed screenshot attempt.

3. You should use a cloud storage service unless sending alerts to Discord, Email, Pushover, Slack or Telegram. These integrations support either embedding screenshots in the email or attaching screenshots to the notification, while other integrations must link screenshots uploaded to a cloud storage bucket. If a cloud storage service has been configured then integrations that support both will link screenshots from the cloud storage bucket instead of embedding or attaching screenshots to the notification.

4. If uploading screenshots to a cloud storage service such as Amazon S3, Azure Blob Storage or Google Cloud Storage; and accessing screenshots in the bucket requires authentication, logging into a VPN or corporate network; then image previews might not work in all instant messaging and communication platforms as some services rewrite URLs to use their CDN. If this happens we recommend using [integrations which support uploading images]({{<relref "#supported-contact-points">}}) or [disabling images in notifications]({{<relref "#configuration">}}) altogether.

5. When uploading screenshots to a cloud storage service Grafana uses a random 20 character (30 characters for Azure Blob Storage) filename for each image. This makes URLs hard to guess but not impossible.

6. Grafana does not delete screenshots from cloud storage. We recommend configuring a retention policy with your cloud storage service to delete screenshots older than 1 month.

7. If Grafana is configured to upload screenshots to its internal web server, and accessing Grafana requires logging into a VPN or corporate network; image previews might not work in all instant messaging and communication platforms as some services rewrite URLs to use their CDN. If this happens we recommend using [integrations which support uploading images]({{<relref "#supported-contact-points">}}) or [disabling images in notifications]({{<relref "#configuration">}}) altogether.

8. Grafana does not delete screenshots uploaded to its internal web server. To delete screenshots from `static_root_path/images/attachments` after a certain amount of time we recommend setting up a CRON job.

## Configuration

> **Note:** Grafana Cloud users can request this feature by [opening a support ticket in the Cloud Portal](/profile/org#support).

Having installed either the image rendering plugin, or set up Grafana to use a remote rendering service, set `capture` in `[unified_alerting.screenshots]` to `true`:

    # Enable screenshots in notifications. You must have either installed the Grafana image rendering
    # plugin, or set up Grafana to use a remote rendering service.
    # For more information on configuration options, refer to [rendering].
    capture = false

If screenshots should be uploaded to cloud storage then `upload_external_image_storage` should also be set to `true`:

    # Uploads screenshots to the local Grafana server or remote storage such as Azure, S3 and GCS. Please
    # see [external_image_storage] for further configuration options. If this option is false, screenshots
    # will be persisted to disk for up to temp_data_lifetime.
    upload_external_image_storage = false

Please see [`[external_image_storage]`]({{< relref "/docs/grafana/latest/setup-grafana/configure-grafana#external_image_storage" >}}) for instructions on how to configure cloud storage. Grafana will not start if `upload_external_image_storage` is `true` and `[external_image_storage]` contains missing or invalid configuration.

If Grafana is acting as its own cloud storage then `[upload_external_image_storage]` should be set to `true` and the `local` provider should be set in [`[external_image_storage]`]({{< relref "/docs/grafana/latest/setup-grafana/configure-grafana#external_image_storage" >}}).

Restart Grafana for the changes to take effect.

## Advanced configuration

We recommended that `max_concurrent_screenshots` is less than or equal to `concurrent_render_request_limit`. The default value for both `max_concurrent_screenshots` and `concurrent_render_request_limit` is `5`:

    # The maximum number of screenshots that can be taken at the same time. This option is different from
    # concurrent_render_request_limit as max_concurrent_screenshots sets the number of concurrent screenshots
    # that can be taken at the same time for all firing alerts where as concurrent_render_request_limit sets
    # the total number of concurrent screenshots across all Grafana services.
    max_concurrent_screenshots = 5

## Supported contact points

Grafana supports a wide range of contact points with varied support for images in notifications. The table below shows the list of all contact points supported in Grafana and their support for uploading screenshots to the receiving service and referencing screenshots that have been uploaded to a cloud storage service.

| Name                    | Upload from disk                                           | Reference from cloud storage                             |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| DingDing                | No                                                         | No                                                       |
| Discord                 | Yes (Maximum of 10 per notification)                       | Yes (Maximum of 10 per notification)                     |
| Email                   | Yes (Embedded in the email)                                | Yes                                                      |
| Google Hangouts Chat    | No                                                         | Yes                                                      |
| Kafka                   | No                                                         | No                                                       |
| Line                    | No                                                         | No                                                       |
| Microsoft Teams         | No                                                         | Yes                                                      |
| Opsgenie                | No                                                         | Yes                                                      |
| Pagerduty               | No                                                         | Yes                                                      |
| Prometheus Alertmanager | No                                                         | No                                                       |
| Pushover                | Yes (Maximum of 1 per notification)                        | No                                                       |
| Sensu Go                | No                                                         | No                                                       |
| Slack                   | Yes (when using Bot tokens, maximum of 5 per notification) | Yes (when using webhooks, maximum of 1 per notification) |
| Telegram                | Yes                                                        | No                                                       |
| Threema                 | No                                                         | No                                                       |
| VictorOps               | No                                                         | No                                                       |
| Webhook                 | No                                                         | Yes                                                      |

## Limitations

- This feature is not supported in Mimir or Loki, or when Grafana is configured to send alerts to other Alertmanagers such as the Prometheus Alertmanager.
- A number of contact points support at most one image per notification. In this case, just the first image is either uploaded to the receiving service or referenced from cloud storage per notification.
- When multiple alerts are sent in a single notification a screenshot might be included for each alert. The order the images are shown is random.
- If uploading screenshots to a cloud storage service such as Amazon S3, Azure Blob Storage or Google Cloud Storage; and accessing screenshots in the bucket requires authentication, logging into a VPN or corporate network; image previews might not work in all instant messaging and communication platforms as some services rewrite URLs to use their CDN.

## Troubleshooting

If Grafana has been set up to send images in notifications, however notifications are still being received without them, follow the troubleshooting steps below:

1. Check that images in notifications has been set up as per the instructions.
2. Enable debug logging in Grafana and look for logs with the logger `ngalert.image`.
3. If the alert is not associated with a dashboard there will be logs for `Cannot take screenshot for alert rule as it is not associated with a dashboard`.
4. If the alert is associated with a dashboard, but no panel in the dashboard, there will be logs for `Cannot take screenshot for alert rule as it is not associated with a panel`.
5. If images cannot be taken because of mis-configuration or an issue with image rendering there will be logs for `Failed to take an image` including the Dashboard UID, Panel ID, and the error message.
6. Check that the contact point supports images in notifications and whether it supports uploading images to the receiving service or referencing images that have been uploaded to a cloud storage service.

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
