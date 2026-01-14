---
aliases:
  - ../../data-sources/google-cloud-monitoring/configure/
description: This document provides configuration instructions for the Google Cloud Monitoring data source.
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - stackdriver
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Google Cloud Monitoring data source
weight: 100
refs:
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
  google-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/
  google-authentication-jwt:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/#create-a-gcp-service-account-and-key-file
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/#create-a-gcp-service-account-and-key-file
  google-authentication-gce:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/#use-gce-default-service-account
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/#use-gce-default-service-account
---

# Configure the Google Cloud Monitoring data source

This document provides instructions for configuring the Google Cloud Monitoring data source in Grafana.

## Before you begin

Before you begin, ensure you have the following:

- **Grafana permissions:** You must have the `Organization administrator` role to configure data sources.
- **GCP project:** A Google Cloud Platform project.
- **GCP permissions:** Permissions to create a service account or configure GCE default service account settings in your GCP project.

Grafana includes a built-in Google Cloud Monitoring data source plugin, so you don't need to install a plugin.

## Set up GCP authentication

Before you can request data from Google Cloud Monitoring, you must configure authentication.
All requests to Google APIs are performed on the server-side by the Grafana backend.

For authentication options and configuration details, refer to [Google authentication](ref:google-authentication).

When you configure Google authentication, note the following requirements specific to Google Cloud Monitoring.

### Configure a GCP Service Account

When you [create a Google Cloud Platform (GCP) Service Account and key file](ref:google-authentication-jwt), the Service Account must have the **Monitoring Viewer** role (**Role > Select a role > Monitoring > Monitoring Viewer**):

{{< figure src="/static/img/docs/v71/cloudmonitoring_service_account_choose_role.png" max-width="600px" class="docs-image--no-shadow" caption="Choose role" >}}

### Grant the GCE Default Service Account scope

If Grafana is running on a Google Compute Engine (GCE) virtual machine, when you [configure a GCE Default Service Account](ref:google-authentication-gce), you must also grant that Service Account access to the "Cloud Monitoring API" scope.

## Enable Google Cloud Platform APIs

Before you can request data from Google Cloud Monitoring, you must enable the necessary APIs in your GCP project.

1. Open the Monitoring and Cloud Resource Manager API pages:
   - [Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com)
   - [Cloud Resource Manager API](https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com)

1. On each page, click **Enable**.

   {{< figure src="/static/img/docs/v71/cloudmonitoring_enable_api.png" max-width="450px" class="docs-image--no-shadow" caption="Enable GCP APIs" >}}

## Add the data source

To add the Google Cloud Monitoring data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Enter `Google Cloud Monitoring` in the search bar.
1. Select **Google Cloud Monitoring**.
1. Click **Add new data source** in the upper right.

You're taken to the **Settings** tab where you configure the data source.

## Configure the data source in the UI

The following are configuration options for the Google Cloud Monitoring data source.

| Setting     | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Name**    | Sets the name you use to refer to the data source in panels and queries. |
| **Default** | Sets whether the data source is pre-selected for new panels.             |

### Authentication

Configure how Grafana authenticates with Google Cloud.

| Setting                 | Description                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication type** | Select the authentication method. Choose **Google JWT File** to use a service account key file, or **GCE Default Service Account** if Grafana is running on a GCE virtual machine. |

### JWT Key Details

These settings appear when you select **Google JWT File** as the authentication type.

| Setting       | Description                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT token** | Upload or paste your Google JWT token. You can drag and drop a `.json` key file, click **Click to browse files** to upload, or use **Paste JWT Token** or **Fill In JWT Token manually**. |

### Service account impersonation

Use service account impersonation to have Grafana authenticate as a different service account than the one provided in the JWT token.

| Setting                            | Description                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Enable**                         | Toggle to enable service account impersonation.                                                     |
| **Service account to impersonate** | Enter the email address of the service account to impersonate when making requests to Google Cloud. |

### Private data source connect

_Only available for Grafana Cloud._

Use private data source connect (PDC) to connect to and query data within a secure network without opening that network to inbound traffic from Grafana Cloud. For more information on how PDC works, refer to [Private data source connect](ref:private-data-source-connect). For steps on setting up a PDC connection, refer to [Configure Grafana private data source connect (PDC)](ref:configure-pdc).

| Setting                         | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| **Private data source connect** | Select a PDC connection from the drop-down menu or create a new connection. |

### Save and test

Click **Save & test** to test the connection. A successful connection displays the following message:

`Successfully queried the Google Cloud Monitoring API.`

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

### Provisioning examples

**Using the JWT (Service Account key file) authentication type:**

```yaml
apiVersion: 1

datasources:
  - name: Google Cloud Monitoring
    type: stackdriver
    access: proxy
    jsonData:
      tokenUri: https://oauth2.googleapis.com/token
      clientEmail: stackdriver@myproject.iam.gserviceaccount.com
      authenticationType: jwt
      defaultProject: my-project-name
    secureJsonData:
      privateKey: |
        -----BEGIN PRIVATE KEY-----
        POSEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCb1u1Srw8ICYHS
        ...
        yA+23427282348234=
        -----END PRIVATE KEY-----
```

**Using the JWT (Service Account private key path) authentication type:**

```yaml
apiVersion: 1

datasources:
  - name: Google Cloud Monitoring
    type: stackdriver
    access: proxy
    jsonData:
      tokenUri: https://oauth2.googleapis.com/token
      clientEmail: stackdriver@myproject.iam.gserviceaccount.com
      authenticationType: jwt
      defaultProject: my-project-name
      privateKeyPath: /etc/secrets/gce.pem
```

**Using GCE Default Service Account authentication:**

```yaml
apiVersion: 1

datasources:
  - name: Google Cloud Monitoring
    type: stackdriver
    access: proxy
    jsonData:
      authenticationType: gce
```

## Provision the data source using Terraform

You can provision the Google Cloud Monitoring data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Terraform prerequisites

Before you begin, ensure you have the following:

- [Terraform](https://www.terraform.io/downloads) installed.
- Grafana Terraform provider configured with appropriate credentials.
- For Grafana Cloud: A [Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/) with data source permissions.

### Provider configuration

Configure the Grafana provider to connect to your Grafana instance:

```hcl
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 2.0.0"
    }
  }
}

# For Grafana Cloud
provider "grafana" {
  url  = "<YOUR_GRAFANA_CLOUD_STACK_URL>"
  auth = "<YOUR_SERVICE_ACCOUNT_TOKEN>"
}

# For self-hosted Grafana
# provider "grafana" {
#   url  = "http://localhost:3000"
#   auth = "<API_KEY_OR_SERVICE_ACCOUNT_TOKEN>"
# }
```

### Terraform examples

The following examples show how to configure the Google Cloud Monitoring data source for each authentication method.

**Using the JWT (Service Account key file) authentication type:**

```hcl
resource "grafana_data_source" "google_cloud_monitoring" {
  type = "stackdriver"
  name = "Google Cloud Monitoring"

  json_data_encoded = jsonencode({
    tokenUri           = "https://oauth2.googleapis.com/token"
    clientEmail        = "<SERVICE_ACCOUNT_EMAIL>"
    authenticationType = "jwt"
    defaultProject     = "<GCP_PROJECT_ID>"
  })

  secure_json_data_encoded = jsonencode({
    privateKey = "<PRIVATE_KEY_CONTENT>"
  })
}
```

**Using the JWT (Service Account private key path) authentication type:**

```hcl
resource "grafana_data_source" "google_cloud_monitoring" {
  type = "stackdriver"
  name = "Google Cloud Monitoring"

  json_data_encoded = jsonencode({
    tokenUri           = "https://oauth2.googleapis.com/token"
    clientEmail        = "<SERVICE_ACCOUNT_EMAIL>"
    authenticationType = "jwt"
    defaultProject     = "<GCP_PROJECT_ID>"
    privateKeyPath     = "/etc/secrets/gce.pem"
  })
}
```

**Using GCE Default Service Account authentication:**

```hcl
resource "grafana_data_source" "google_cloud_monitoring" {
  type = "stackdriver"
  name = "Google Cloud Monitoring"

  json_data_encoded = jsonencode({
    authenticationType = "gce"
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
