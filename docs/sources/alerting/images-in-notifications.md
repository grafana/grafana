---
aliases:
description:
keywords:
  - grafana
  - alerting
  - images
  - notifications
title: Images in notifications
---

# Images in notifications

Images in notifications helps recipients of alert notifications better understand why an alert has fired or resolved by including an image of the panel for the Grafana managed alert rule.

> **Note**: Images in notifications are not available for Grafana Mimir and Loki managed alert rules, or when Grafana is set up to send alert notifications to an external Alertmanager.

If Grafana is set up to send images in notifications, it takes a screenshot of the panel for the Grafana managed alert rule when either of the following happen:

1. The alert rule transitions from pending to firing
2. The alert rule transitions from firing to OK

Images are stored in the [data]({{< relref "../setup-grafana/configure-grafana/#paths" >}}) path and so Grafana must have write-access to this path. If Grafana cannot write to this path then screenshots cannot be saved to disk and an error will be logged for each failed screenshot attempt. In addition to storing images on disk, Grafana can also store the image in an external image store such as Amazon S3, Azure Blob Storage, Google Cloud Storage and even Grafana where screenshots are stored in `public/img/attachments`. Screenshots older than `temp_data_lifetime` are deleted from disk but not the external image store. If Grafana is the external image store then screenshots are deleted from `data` but not from `public/img/attachments`.

> **Note**: It is recommended that you use an external image store, as not all contact points support uploading images from disk. It is also possible that the image on disk is deleted before an alert notification is sent if `temp_data_lifetime` is less than the `group_wait` and `group_interval` options used in Alertmanager.

## Requirements

To use images in notifications, Grafana must be set up to use [image rendering]({{< relref "../setup-grafana/image-rendering/" >}}). It is also recommended that Grafana is set up to upload images to an [external image store]({{< relref "../setup-grafana/configure-grafana/#external_image_storage" >}}) such as Amazon S3, Azure Blob Storage, Google Cloud Storage or even Grafana.

## Configuration

If Grafana has been set up to use [image rendering]({{< relref "../setup-grafana/image-rendering/" >}}) images in notifications can be turned on via the `capture` option in `[unified_alerting.screenshots]`:

    # Enable screenshots in notifications. This option requires a remote HTTP image rendering service. Please
    # see [rendering] for further configuration options.
    capture = true

It is recommended that `max_concurrent_screenshots` is set to a value that is less than or equal to `concurrent_render_request_limit`. The default value for both `max_concurrent_screenshots` and `concurrent_render_request_limit` is `5`:

    # The maximum number of screenshots that can be taken at the same time. This option is different from
    # concurrent_render_request_limit as max_concurrent_screenshots sets the number of concurrent screenshots
    # that can be taken at the same time for all firing alerts where as concurrent_render_request_limit sets
    # the total number of concurrent screenshots across all Grafana services.
    max_concurrent_screenshots = 5

If Grafana has been set up to use an external image store, `upload_external_image_storage` should be set to `true`:

    # Uploads screenshots to the local Grafana server or remote storage such as Azure, S3 and GCS. Please
    # see [external_image_storage] for further configuration options. If this option is false, screenshots
    # will be persisted to disk for up to temp_data_lifetime.
    upload_external_image_storage = false

Restart Grafana for the changes to take affect.

## Supported notifiers

Images in notifications are supported in the following notifiers and additional support will be added in the future:

| Name                    | Upload images from disk | Include images from URL |
| ----------------------- | ----------------------- | ----------------------- |
| DingDing                | No                      | No                      |
| Discord                 | Yes                     | Yes                     |
| Email                   | Yes                     | Yes                     |
| Google Hangouts Chat    | No                      | Yes                     |
| Kafka                   | No                      | No                      |
| Line                    | No                      | No                      |
| Microsoft Teams         | No                      | Yes                     |
| Opsgenie                | No                      | Yes                     |
| Pagerduty               | No                      | Yes                     |
| Prometheus Alertmanager | No                      | No                      |
| Pushover                | No                      | No                      |
| Sensu Go                | No                      | No                      |
| Slack                   | No                      | Yes                     |
| Telegram                | No                      | No                      |
| Threema                 | No                      | No                      |
| VictorOps               | No                      | No                      |
| Webhook                 | No                      | Yes                     |
| WeCom                   | No                      | No                      |

Include images from URL refers to using the external image store.

## Metrics

Grafana provides the following metrics to observe the performance and failure rate of images in notifications.
For example, if a screenshot could not be taken within the expected time (10 seconds) then the counter `grafana_screenshot_failures_total` is updated.

- `grafana_screenshot_cache_hits_total`
- `grafana_screenshot_cache_misses_total`
- `grafana_screenshot_duration_seconds`
- `grafana_screenshot_failures_total`
- `grafana_screenshot_successes_total`
- `grafana_screenshot_upload_failures_total`
- `grafana_screenshot_upload_successes_total`

## Limitations

- Images in notifications are not available for Grafana Mimir and Loki managed alert rules, or when Grafana is set up to send alert notifications to an external Alertmanager.
- When alerts generated by different alert rules are sent in a single notification, there may be screenshots for each alert rule. This happens if an alert group contains multiple alerting rules. The order the images are attached is random. If you need to guarantee the ordering of images, make sure that your alert groups contain a single alerting rule.
- Some contact points only handle a single image. In this case, the first image associated with an alert will be attached. Because the ordering is random, this may not always be an image for the same alert rule. If you need to guarantee you receive a screenshot for a particular rule, make sure that your alert groups contain a single alerting rule.
