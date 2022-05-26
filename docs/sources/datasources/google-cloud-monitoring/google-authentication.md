---
aliases:
  - /docs/grafana/next/datasources/cloudmonitoring/
description: Google authentication
keywords:
  - grafana
  - google
  - authentication
title: Authentication
weight: 5
---

# Google authentication

Requests from a Grafana plugin to Google are made on behalf of an IAM role or an IAM user. The IAM user or IAM role must have the associated policies to perform certain API actions. Since these policies are specific to each data source, refer to the data source documentation for details. All requests to Google APIs are performed on the server-side by the Grafana backend.

You can authenticate a Grafana plugin to Google by uploading a Google JWT file or by automatically retrieving credentials from the Google metadata server. The latter option is only available when running Grafana on GCE virtual machine.

## Using Google Service Account Key File

To authenticate the Grafana plugin with the Google API, create a Google Cloud Platform (GCP) Service Account for the Project you want to show data. A Grafana data source integrates with one GCP Project. If you want to visualize data from multiple GCP Projects, then create one data source per GCP Project.

### Create a GCP Service Account for a Project

1. Navigate to the [APIs and Services Credentials page](https://console.cloud.google.com/apis/credentials).
1. Click on the **Create credentials** dropdown and select the **Service account** option.
1. In **Service account name**, enter a name for the account.
1. From the **Role** dropdown, choose the roles required by the specific plugin.
1. Click **Done**.
1. Use the newly created account to [create a service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys#iam-service-account-keys-create-console). A JSON key file is created and downloaded to your computer.
1. Store this file in a secure place as it allows access to your Google data.
1. Upload the key to Grafana via the data source configuration page.
   The file contents is encrypted and saved in the Grafana database. Don't forget to save the file after uploading!

## Using GCE Default Service Account

When Grafana is running on a Google Compute Engine (GCE) virtual machine, Grafana can automatically retrieve default credentials from the metadata server. As a result, there is no need to generate a private key file for the service account. You also do not need to upload the file to Grafana. The following preconditions must be met before Grafana can retrieve default credentials.

- You must create a Service Account for use by the GCE virtual machine. For more information, refer to [Create new service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#createanewserviceaccount).
- Verify that the GCE virtual machine instance is running as the service account that you created. For more information, refer to [setting up an instance to run as a service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#using).
- Allow access to the specified API scope.

For more information about creating and enabling service accounts for GCE instances, refer to [enabling service accounts for instances in Google documentation](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).
