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
---

# Configure Amazon SNS for Alerting

Use the Grafana Alerting - Amazon SNS integration to send notifications to Amazon SNS when your alerts are firing. You can receive notifications via the various subscriber channels supported by SNS.

## Before you begin

Before you begin, ensure you have the following:

- **AWS SNS Topic**: An SNS topic to send notifications to.
- **AWS IAM Identity with necessary access**: An IAM identity (e.g. user, role) with the necessary permissions to publish messages to the SNS topic.

For an example setup, see [Example Minimal Setup Using Assumed IAM Role](#example-minimal-setup-using-assumed-iam-role).

## Adding the SNS Contact Point in Grafana

With AWS resources configured, proceed to add SNS as a contact point in Grafana.

- Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
- Click on **"Add contact point"**.
- **Name**: Enter a descriptive name (e.g., `AWS SNS`).
- Choose **"AWS SNS"** from the list of contact point types.

### 2. Configure SNS Settings

#### SNS Settings

- **The Amazon SNS API URL**: (Optional) The SNS API URL, e.g., `https://sns.us-east-2.amazonaws.com`. If not specified, the SNS API URL from the SNS SDK will be used.
- **Signature Version (sigv4)**: Configures AWS's Signature Verification 4 signing process to sign requests.
  - **Region**: (Optional) The AWS region. If blank, the region from the default credentials chain is used.
  - **Access Key**: The AWS API access key.
  - **Secret Key**: The AWS API secret key.
  - **Profile**: (Optional) Named AWS profile used to authenticate.
  - **Role ARN**: (Optional) The ARN of an AWS IAM role to assume for authentication, serving as an alternative to using AWS API keys.
- **SNS topic ARN**: (Optional) If you don't specify this value, you must specify a value for the `Phone number` or `Target ARN`. If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes to prevent messages with the same group key being deduplicated by the SNS default deduplication window.
- **Phone number**: (Optional) Phone number if message is delivered via SMS in E.164 format. If you don't specify this value, you must specify a value for the `SNS topic ARN` or `Target ARN`.
- **Target ARN**: (Optional) The mobile platform endpoint ARN if message is delivered via mobile notifications. If you don't specify this value, you must specify a value for the `SNS topic ARN` or `Phone number`.
- **Subject**: (Optional) Customize the subject line or use the default template. This field is templateable.
- **Message**: (Optional) Customize the message content or use the default template. This field is templateable.
- **Attributes**: (Optional) Add any SNS message attributes.

{{< admonition type="note" >}}
Both `Access Key` and `Secret Key` must be provided together or left blank together. If blank it defaults to a chain of credential
providers to search for credentials in environment variables, shared credential file, and EC2 Instance Roles.

Environment variables: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
{{< /admonition >}}

### 3. Test & Save the Contact Point

- Click **"Test"** to verify that the SNS configuration is working correctly.
- After the test is successful, click **"Save contact point"** to add the SNS contact point.

### 4. Next steps

The SNS contact point is ready to receive alert notifications.

To add this contact point to your alert, complete the following steps.

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under Notifications click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. **Click Save rule and exit**.

## Example Minimal Setup Using Assumed IAM Role

This section outlines a minimal setup to configure SNS with Grafana using an assumed IAM Role.

### 1. Create an SNS Topic

1. **Navigate to SNS in AWS Console**:

   - Go to the [Amazon SNS Console](https://console.aws.amazon.com/sns/v3/home).

2. **Create a new topic** [[AWS Documentation](https://docs.aws.amazon.com/sns/latest/dg/sns-create-topic.html)]:

   - On the **Topics** page, choose **"Create topic"**.
   - Select **"Standard"** as the type.
   - Enter a **Name** for your topic, e.g., `My-Topic`.
   - **Encryption**: Leave disabled for this minimal setup.
   - Click **"Create topic"**.

3. (Optional) **Add an email subscriber to help test** [[AWS Documentation](https://docs.aws.amazon.com/sns/latest/dg/sns-email-notifications.html)]:
   - Within your newly created topic, click on **"Create subscription"**.
   - **Protocol**: Choose `Email`.
   - **Endpoint**: Enter your email address to receive test notifications.
   - Click **"Create subscription"**.
   - **Confirm Subscription**: Check your email and confirm the subscription by clicking the provided link.

### 2. Create an IAM Role

1. **Navigate to IAM in AWS Console**:

   - Go to the [IAM Console](https://console.aws.amazon.com/iam/home).

2. **Create a new role** [[AWS Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user.html)]:

   - On the **Roles** page, choose **"Create role"**.
   - **Trusted Entity**: Select **"This account"**.
   - Click **"Next"** until the end, name it (e.g., `GrafanaSNSRole`), and click **"Create role"**.

3. **Attach Inline Policy**:

   - After creating the role, select it and navigate to the **"Permissions"** tab.
   - Click on **"Add permission"** > **"Create inline policy"**.
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

### 3. Create an IAM Policy

1. **Create a new policy to allow assuming the above IAM role** [[AWS Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html)]:

   - In the IAM Console, on the **Policies** page, choose **"Create policy"**.
   - Switch to the **"JSON"** tab and paste the following policy, replacing `Resource` with the ARN of the role you created earlier:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "sts:AssumeRole",
         "Resource": "arn:aws:iam::<account_id>:role/GrafanaSNSRole"
       }
     ]
   }
   ```

2. **Review and Create**:
   - Click **"Next"**, name it (e.g., `AssumeSNSRolePolicy`), and click **"Create policy"**.

### 4. Create an IAM User

1. **Create a new IAM user to assume the above role** [[AWS Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html)]:

   - In the IAM Console, on the **Users** page, choose **"Create user"**.
   - Enter a **User name**, e.g., `grafana-sns-user`.
   - Click **"Next"**.
   - Select **"Attach policies directly"**.
   - Search for the policy you created earlier (`AssumeSNSRolePolicy`) and select it.
   - Click **"Next"** , and click **"Create user"**.

2. **Generate credentials**:
   - Within your newly created user, click on **"Create access key"**.
   - Select an appropriate use-case, e.g., `Application running outside AWS`.
   - Click **"Next"** , and click **"Create access key"**.
   - **Save Credentials**: Note the **Access key ID** and **Secret access key**. You'll need these for Grafana's configuration.

### 5. Add the SNS Contact Point in Grafana

After creating the IAM user and obtaining the necessary credentials, proceed to [configure the SNS contact point in Grafana](#adding-the-sns-contact-point-in-grafana) using the following details:

- **The Amazon SNS API URL**: `https://sns.us-east-1.amazonaws.com`
- **Signature Version (sigv4)**:
  - **Region**: `us-east-1`
  - **Access Key**: `<YOUR_ACCESS_KEY>`.
  - **Secret Key**: `<YOUR_SECRET_ACCESS_KEY>`
  - **Role ARN**: `arn:aws:iam::<account_id>:role/GrafanaSNSRole`
- **SNS topic ARN**: `arn:aws:sns:<region>:<account_id>:My-Topic`

{{< admonition type="note" >}}
Replace the placeholder values (`https://sns.us-east-1.amazonaws.com`, `us-east-1`, `<YOUR_ACCESS_KEY>`, `<YOUR_SECRET_ACCESS_KEY>`, `arn:aws:iam::<account_id>:role/GrafanaSNSRole`, `arn:aws:sns:<region>:<account_id>:My-Topic`) with your actual AWS credentials and ARNs.
{{< /admonition >}}

## Additional Resources

- [Amazon SNS Documentation](https://docs.aws.amazon.com/sns/index.html)
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/index.html)
- [Prometheus Alertmanager SNS Integration](https://prometheus.io/docs/alerting/configuration/#sns_config)
- [Cloudwatch AWS Authentication](../../../../../datasources/aws-cloudwatch/aws-authentication/)
