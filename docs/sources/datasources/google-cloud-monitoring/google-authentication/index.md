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
  - oauth
  - workload identity federation
  - wif
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Google authentication
title: Google authentication
weight: 200
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

| Method                            | Use case                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Google JWT File**               | Use when Grafana runs outside of GCP, or when you need explicit control over credentials.                                |
| **GCE Default Service Account**   | Use when Grafana runs on a Google Compute Engine VM with a configured service account.                                   |
| **Forward OAuth Identity**        | Use when you sign in to Grafana with Google and want each query to run as the signed-in user.                            |
| **Workload Identity Federation**  | Use on Grafana Cloud to let users authenticate with an external OIDC identity provider instead of a service account key. |
| **Service Account Impersonation** | Use when you need Grafana to act as a different service account than the one it authenticates with.                      |

## Use a Google service account key file

Use this method when Grafana runs outside of Google Cloud Platform, or when you need explicit control over which credentials are used.

Each Grafana data source connects to one GCP project by default. To visualize data from multiple GCP projects, create one data source per project, or use service account impersonation.

### Create a GCP service account and key file

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

## Use Forward OAuth Identity

Use this method when your Grafana instance authenticates users with Google OAuth and you want each query to run as the signed-in user instead of as a shared service account. This enables per-user access control: a viewer who lacks Cloud Monitoring permissions on a project sees no data from that project, even when the dashboard's data source is shared.

Grafana forwards the user's existing Google OAuth access token as the bearer token on outgoing Cloud Monitoring API requests. No service account key is stored on the server.

### Prerequisites for Forward OAuth Identity

Before using this method, ensure the following:

- Your Grafana instance is configured to sign users in with [Google authentication](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/google/).
- The Google OAuth client requests the `https://www.googleapis.com/auth/monitoring.read` scope on top of the default `openid email profile` scopes. Without this scope, the user's token is rejected by the Cloud Monitoring API with a `403` response.
- Each user who needs to query the data source has the **Monitoring Viewer** role (`roles/monitoring.viewer`) on the target GCP project.

### Configure the Google OAuth scope

Add the Cloud Monitoring read scope to your Google authentication configuration in `grafana.ini` or `custom.ini`:

```ini
[auth.google]
scopes = openid email profile https://www.googleapis.com/auth/monitoring.read
```

If you configure Google authentication through the Grafana SSO settings UI, add the same scope value to the **Scopes** field.

After you change the scopes, existing user sessions still hold tokens issued under the old scope set. Each affected user must sign out, revoke the existing grant at [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions), and sign in again to consent to the new scope. Otherwise, queries continue to fail with `403`.

### Configure the data source

1. In Grafana, navigate to the Google Cloud Monitoring data source configuration page.
1. Under **Authentication type**, select **Forward OAuth Identity**.
1. In **Default project**, enter the GCP project ID to query. This field is required because the user's OAuth token doesn't carry a project context.
1. Click **Save & test** to verify the connection.

{{< admonition type="note" >}}
Service account impersonation isn't compatible with Forward OAuth Identity. The data source authenticates as the signed-in user, so there's no service account to impersonate.
{{< /admonition >}}

## Use Workload Identity Federation

Use [Google Cloud Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) (WIF) to let Grafana users authenticate to Cloud Monitoring with an external identity provider (such as Okta or another OIDC provider) instead of a service account key.

{{< admonition type="note" >}}
This authentication method is available on **Grafana Cloud** only. Grafana Cloud exchanges the signed-in user's external OIDC token for a short-lived Google Cloud access token before the request reaches the plugin.
{{< /admonition >}}

Configuring Workload Identity Federation involves three systems: Google Cloud, your Grafana Cloud stack, and the data source itself.

### Configure Google Cloud

1. Create a [Workload Identity Pool and Provider](https://cloud.google.com/iam/docs/workload-identity-federation-with-other-providers) that trusts your OIDC identity provider. When configuring the provider, set up attribute mappings so that `google.subject` maps to the relevant claim from your identity provider (for example, `assertion.sub` — the exact mapping depends on your provider's claim format).
1. Grant the Cloud Monitoring permissions needed to run queries. How you grant them depends on whether you use service account impersonation:
   - **Without impersonation** — grant the WIF pool principal the **Monitoring Viewer** role (`roles/monitoring.viewer`) directly.
   - **With impersonation** — create a service account, grant it the **Monitoring Viewer** role, then grant the WIF pool principal the **Service Account Token Creator** role (`roles/iam.serviceAccountTokenCreator`) on that service account.

### Configure Grafana Cloud

1. Configure your Grafana Cloud stack's SSO integration against the same OIDC provider, so the signed-in user's identity is available for Grafana Cloud to exchange for a Google Cloud access token before the request reaches the plugin. Refer to [Configure OAuth2 authentication](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/generic-oauth/) for setup details.

### Configure the data source

1. In Grafana, navigate to the Google Cloud Monitoring data source configuration page.
1. Under **Authentication type**, select **Workload Identity Federation**.
1. In the **Workload Identity Pool Provider** field, enter the full resource path of your provider:

   `projects/<project-number>/locations/global/workloadIdentityPools/<pool-id>/providers/<provider-id>`

   {{< admonition type="note" >}}
   Use the **project number** (a numeric ID such as `123456789`), not the project ID (such as `my-project`). You can find the project number on the Google Cloud Console home page.
   {{< /admonition >}}

1. If you set up service account impersonation, enter the service account email in the **Service account email** field. If you granted permissions directly to the WIF pool, leave this blank.
1. In **Default project**, enter the GCP project ID where your Cloud Monitoring queries run.
1. Click **Save & test** to verify the connection.

{{< admonition type="note" >}}
Credentials from Workload Identity Federation are tied to the signed-in user's active session — there is no long-lived credential available to the Grafana backend. This means any feature that runs without a user present won't work, including alerting, scheduled reports, and public dashboards. If you rely on these features, use a service account key (JWT) instead.
{{< /admonition >}}

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
1. Enable **Service Account Impersonation**.
1. Enter the email address of the target service account.
1. Click **Save & test** to verify the connection.

For more information, refer to the [Google documentation on service account impersonation](https://cloud.google.com/iam/docs/service-account-impersonation).
