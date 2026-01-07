---
aliases:
  - ../../data-sources/google-cloud-monitoring/google-authentication/
description: Configure authentication methods to connect Grafana to Google Cloud Monitoring
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - authentication
  - service account
  - jwt
  - gce
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Google authentication
title: Google authentication
weight: 200
refs:
  configure-gcm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
---

# Google authentication

This document explains how to configure authentication between Grafana and Google Cloud Platform (GCP). You must configure authentication before you can use the Google Cloud Monitoring data source to query metrics and SLOs.

All requests to Google APIs are performed on the server-side by the Grafana backend.

## Before you begin

Before you configure authentication, ensure you have the following:

- A Google Cloud Platform project with the Monitoring API enabled.
- Permissions to create service accounts or configure GCE instance settings in your GCP project.
- Access to the Grafana data source configuration page.

## Supported authentication methods

The Google Cloud Monitoring data source supports the following authentication methods:

| Method                           | Use case                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| **Google JWT File**              | Use when Grafana runs outside of GCP, or when you need explicit control over credentials.    |
| **GCE Default Service Account**  | Use when Grafana runs on a Google Compute Engine VM with a configured service account.       |
| **Service account impersonation** | Use when you need Grafana to act as a different service account than the one it authenticates with. |

## Use a Google Service Account key file

Use this method when Grafana runs outside of Google Cloud Platform, or when you need explicit control over which credentials are used.

Each Grafana data source connects to one GCP project by default. To visualize data from multiple GCP projects, create one data source per project, or use service account impersonation.

### Create a GCP Service Account and key file

To create a service account and download its key file:

1. Navigate to the [APIs and Services Credentials page](https://console.cloud.google.com/apis/credentials) in the GCP Console.
1. Click the **Create credentials** dropdown and select **Service account**.
1. In **Service account name**, enter a name for the account.
1. Click **Create and continue**.
1. In the **Grant this service account access to project** section, select the **Monitoring Viewer** role from the **Role** dropdown.
1. Click **Continue**, then click **Done**.
1. In the service accounts list, click the service account you created.
1. Go to the **Keys** tab and click **Add key** > **Create new key**.
1. Select **JSON** and click **Create**.

   A JSON key file downloads to your computer.

1. Store the key file securely. It grants access to your Google Cloud data.

### Upload the key file to Grafana

1. In Grafana, navigate to the Google Cloud Monitoring data source configuration page.
1. Under **Authentication type**, select **Google JWT File**.
1. Upload the JSON key file using one of the available methods (drag and drop, browse, or paste).
1. Click **Save & test** to verify the connection.

### Grant access to multiple projects

You can configure a single service account to access multiple GCP projects:

1. Create a service account and key file following the steps above.
1. Note the service account email address (for example, `grafana-monitoring@my-project.iam.gserviceaccount.com`).
1. In each additional project you want to access:
   1. Navigate to **IAM & Admin** > **IAM**.
   1. Click **Grant access**.
   1. Enter the service account email address.
   1. Assign the **Monitoring Viewer** role.
   1. Click **Save**.
1. Use the original key file in Grafana. The service account can now access all configured projects.

## Use GCE Default Service Account

When Grafana runs on a Google Compute Engine (GCE) virtual machine, it can automatically retrieve credentials from the GCE metadata server. This method doesn't require you to create or manage key files.

### Prerequisites for GCE authentication

Before using this method, ensure the following:

- Grafana is running on a GCE virtual machine.
- The VM has a service account assigned with the **Monitoring Viewer** role.
- The VM has the **Cloud Monitoring API** scope enabled.

### Configure the GCE instance

1. In the GCP Console, navigate to **Compute Engine** > **VM instances**.
1. Stop the VM if it's running (you can't change scopes on a running VM).
1. Click the VM name, then click **Edit**.
1. Under **Service account**, select a service account with the **Monitoring Viewer** role.
1. Under **Access scopes**, select **Set access for each API** and enable the **Cloud Monitoring API** (read-only).
1. Click **Save** and restart the VM.

### Configure the data source

1. In Grafana, navigate to the Google Cloud Monitoring data source configuration page.
1. Under **Authentication type**, select **GCE Default Service Account**.
1. Click **Save & test** to verify the connection.

For more information about GCE service accounts, refer to the [Google documentation on service accounts for instances](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).

## Configure service account impersonation

Service account impersonation allows Grafana to authenticate as one service account but act as a different service account when making API requests. This is useful for:

- Accessing resources across multiple projects with a single configuration.
- Following the principle of least privilege by separating authentication from authorization.
- Auditing and tracking which service account accessed specific resources.

### Prerequisites for impersonation

The service account used by Grafana (the "caller") must have the following:

- The `iam.serviceAccounts.getAccessToken` permission on the target service account.
- This permission is included in the **Service Account Token Creator** role (`roles/iam.serviceAccountTokenCreator`).

The service account being impersonated (the "target") must have:

- The **Monitoring Viewer** role on the projects you want to access.

### Configure impersonation

1. In the GCP Console, grant the caller service account the **Service Account Token Creator** role on the target service account.
1. Grant the target service account the **Monitoring Viewer** role on the relevant projects.
1. In Grafana, navigate to the Google Cloud Monitoring data source configuration page.
1. Configure authentication using either **Google JWT File** or **GCE Default Service Account**.
1. Enable **Service account impersonation**.
1. Enter the email address of the target service account.
1. Click **Save & test** to verify the connection.

For more information, refer to the [Google documentation on service account impersonation](https://cloud.google.com/iam/docs/service-account-impersonation).
