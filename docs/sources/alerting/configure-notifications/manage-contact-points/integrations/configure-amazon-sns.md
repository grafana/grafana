---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-amazon-sns/
description: Configure the Grafana Alerting - Amazon SNS integration to receive alert notifications when your alerts are firing.
keywords:
  - grafana
  - alerting
  - Amazon SNS
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Amazon SNS
title: Configure Amazon SNS for Alerting
weight: 0
---

# Configure Amazon SNS for Alerting

Use the Grafana Alerting - Amazon SNS integration to send notifications to Amazon SNS when your alerts are firing.

## Before you begin

To configure Amazon SNS to receive alert notifications, complete the following steps.

1. Create a new topic in https://console.aws.amazon.com/sns.
1. Open the topic and create a new subscription.
1. Choose the protocol HTTPS.
1. Copy the URL.

For more information, refer to [Amazon SNS documentation](https://docs.aws.amazon.com/sns/latest/dg/welcome.html).

## Procedure

To create your Amazon SNS integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **AWS SNS**.
1. Copy in the URL from above into the **The Amazon SNS API URL** field.
1. Click **Test** to check that your integration works.
1. Click **Save contact point**.

## Next steps

The Amazon SNS contact point is ready to receive alert notifications.

To add this contact point to your alert, complete the following steps.

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under Notifications click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. **Click Save rule and exit**.
