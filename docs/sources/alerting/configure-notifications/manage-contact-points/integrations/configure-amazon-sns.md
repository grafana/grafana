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
weight: 100
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
  test-contact-point:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/#test-a-contact-point
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/#test-a-contact-point
  enable-contact-point-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/#enable-notifications-for-a-contact-point
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/#enable-notifications-for-a-contact-point
---

# Configure Amazon SNS notifications

Use the Amazon SNS integration in a contact point to send alert notifications to a SNS topic. Then, configure the SNS topic to forward notifications to distinct subscriber channels used in your SNS account.

## Before you begin

Before you begin, ensure you have the following:

- **AWS SNS Topic**: An SNS topic to send notifications to.
- **AWS IAM Identity with necessary access**: An IAM identity (e.g. user, role) with the necessary permissions to publish messages to the SNS topic.

For a minimal setup, refer to [Example using an Access Key](#example-using-an-access-key).

## Configure Amazon SNS for a contact point

To create a contact point with a SNS integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **AWS SNS**.
1. Set up the required [settings](#sns-settings) for your SNS configuration.
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

## SNS Settings

- **The Amazon SNS API URL**: (Optional) The SNS API URL, e.g., `https://sns.us-east-2.amazonaws.com`. If not specified, the SNS API URL from the SNS SDK will be used.
- **Signature Version (sigv4)**: Configures AWS's Signature Verification 4 signing process to sign requests.
  - **Region**: (Optional) The AWS region. If blank, the region from the default credentials chain is used.
  - **Access Key** : (Optional) The AWS API access key.
  - **Secret Key**: (Optional) The AWS API secret key.
    > Both `Access Key` and `Secret Key` must be provided together or left blank together.
    >
    > If left blank, Grafana searches for credentials using the default credentials chain, including environment variables (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`), the shared credential file, and EC2 instance roles.
  - **Profile**: (Optional) Named AWS profile used to authenticate.
  - **Role ARN**: (Optional) The ARN of an AWS IAM role to assume for authentication, serving as an alternative to using AWS API keys.
- **SNS topic ARN**: (Optional) If you don't specify this value, you must specify a value for the `Phone number` or `Target ARN`. If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes to prevent messages with the same group key being deduplicated by the SNS default deduplication window.
- **Phone number**: (Optional) Phone number if message is delivered via SMS in E.164 format. If you don't specify this value, you must specify a value for the `SNS topic ARN` or `Target ARN`.
- **Target ARN**: (Optional) The mobile platform endpoint ARN if message is delivered via mobile notifications. If you don't specify this value, you must specify a value for the `SNS topic ARN` or `Phone number`.
- **Subject**: (Optional) Customize the subject. This field supports [notification templates](ref:notification-templates) and, by default, uses the default title template (`default.title`). It **cannot be an empty string**.
- **Message**: (Optional) Customize the message. This field supports [notification templates](ref:notification-templates) and, by default, uses the default message template (`default.message`).
- **Attributes**: (Optional) Add any SNS message attributes.

## Example using an Access Key

This section outlines a minimal setup to configure Amazon SNS with Alerting.

### 1. Create an SNS Topic and Email Subscriber

1. **Navigate to SNS in AWS Console**:

   - Go to the [Amazon SNS Console](https://console.aws.amazon.com/sns/v3/home).

2. **Create a new topic**:

   - On the **Topics** page, choose **"Create topic"**.
   - Select **"Standard"** as the type.
   - Enter a **Name** for your topic, e.g., `My-Topic`.
   - **Encryption**: Leave disabled for this minimal setup.
   - Click **"Create topic"**.

3. (Optional) **Add an email subscriber to help test**:
   - Within your newly created topic, click on **"Create subscription"**.
   - **Protocol**: Choose `Email`.
   - **Endpoint**: Enter your email address to receive test notifications.
   - Click **"Create subscription"**.
   - **Confirm Subscription**: Check your email and confirm the subscription by clicking the provided link.

### 2. Create an IAM Policy, User, and Access Key

1. **Navigate to IAM in AWS Console**:

   - Go to the [IAM Console](https://console.aws.amazon.com/iam/home).

2. **Create a new policy**:

   - On the **Policies** page, choose **"Create policy"**.
   - Switch to the **"JSON"** tab and paste the following policy, replacing `Resource` with your SNS topic ARN:

     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": ["sns:Publish", "sns:GetTopicAttributes"],
           "Resource": "arn:aws:sns:<region>:<account_id>:<topic_name>"
         }
       ]
     }
     ```

   - Click **"Next"**, name it (e.g., `SNSPublishPolicy`), and click **"Create policy"**.

3. **Create a new IAM user and assign the policy**

   - In the IAM Console, on the **Users** page, choose **"Create user"**.
   - Enter a **User name**, e.g., `alerting-sns-user`.
   - Click **"Next"**.
   - In **Set permissions**, select **"Attach policies directly"**.
   - Search for the policy you created earlier (`SNSPublishPolicy`) and select it.
   - Click **"Next"** , and click **"Create user"**.

4. **Create an Access Key**:
   - Within your newly created user, click on **"Create access key"**.
   - Select an appropriate use-case, e.g., `Application running outside AWS`.
   - Click **"Next"** , and click **"Create access key"**.
   - **Save Credentials**: Note the **Access key ID** and **Secret access key** that are required in the next step.

### 3. Configure the SNS Contact Point in Grafana

Follow the steps in [configure Amazon SNS for a contact point](#configure-amazon-sns-for-a-contact-point), using the settings below and replacing the placeholders with the SNS and IAM values created in the previous steps.

- **The Amazon SNS API URL**: `https://sns.<region>.amazonaws.com`
- **Signature Version (sigv4)**:
  - **Region**: `<region>`
  - **Access Key**: `<YOUR_ACCESS_KEY>`.
  - **Secret Key**: `<YOUR_SECRET_ACCESS_KEY>`
- **SNS topic ARN**: `arn:aws:sns:<region>:<account_id>:<topic_name>`

[Test the contact point](ref:test-contact-point) to ensure it's working, or [enable notifications](ref:enable-contact-point-notifications) for it.

## Additional Resources

- [Configure contact points](ref:configure-contact-points)
- [Amazon SNS Documentation](https://docs.aws.amazon.com/sns/index.html)
- [Amazon IAM Documentation](https://docs.aws.amazon.com/iam/index.html)
- [Prometheus Alertmanager SNS Configuration](https://prometheus.io/docs/alerting/configuration/#sns_config)
