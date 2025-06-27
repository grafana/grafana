---
aliases:
  - /docs/grafana/next/datasources/cloudmonitoring/
description: Google authentication
keywords:
  - grafana
  - google
  - authentication
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Authentication
weight: 5
---

# Configure Google authentication

Requests from a Grafana plugin to Google are made on behalf of an Identity and Access Management (IAM) role or IAM user.
The IAM user or IAM role must have the associated policies to perform certain API actions.
Since these policies are specific to each data source, refer to the data source documentation for details.

All requests to Google APIs are performed on the server-side by the Grafana backend.
You can authenticate a Grafana plugin to Google by uploading a Google JSON Web Token (JWT) file, or by automatically retrieving credentials from the Google metadata server.
The latter option is available only when running Grafana on a GCE virtual machine.

## Use a Google Service Account key file

To authenticate the Grafana plugin with the Google API, create a Google Cloud Platform (GCP) Service Account for the Project you want to show data.

Each Grafana data source integrates with one GCP Project.
To visualize data from multiple GCP Projects, create one data source per GCP Project.

### Create a GCP Service Account and key file

1. Navigate to the [APIs and Services Credentials page](https://console.cloud.google.com/apis/credentials).
1. Click on the **Create credentials** dropdown and select the **Service account** option.
1. In **Service account name**, enter a name for the account.
1. From the **Role** dropdown, choose the roles required by the specific plugin.
1. Click **Done**.
1. Use the newly created account to [create a service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys#iam-service-account-keys-create-console).
   A JSON key file is created and downloaded to your computer.
1. Store the key file in a secure place, because it grants access to your Google data.
1. In the Grafana data source configuration page, upload the key file.
   The file's contents are encrypted and saved in the Grafana database.
   Remember to save the file after uploading.

#### Create a GCP service account for multiple projects

You can create a service account and key file that can be used to access multiple projects. Follow steps 1-5 above, then:

1. Note the email address of the service account, it will look a little strange like `foobar-478@main-boardwalk-90210.iam.gserviceaccount.com`.
1. Navigate to the other project(s) you want to access.
1. Add the service account email address to the IAM page of each project, and grant it the required roles.
1. Navigate back to the original project's service account and create a [service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys#iam-service-account-keys-create-console). A JSON key file is created and downloaded to your computer
1. Store the key file in a secure place, because it grants access to your Google data.
1. In the Grafana data source configuration page, upload the key file.
   The file's contents are encrypted and saved in the Grafana database.
   Remember to save the file after uploading.

## Configure a GCE default service account

When Grafana is running on a Google Compute Engine (GCE) virtual machine, Grafana can automatically retrieve default credentials from the metadata server. As a result, there is no need to generate a private key file for the service account. You also do not need to upload the file to Grafana. The following preconditions must be met before Grafana can retrieve default credentials.

- You must create a Service Account for use by the GCE virtual machine. For more information, refer to [Create new service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#createanewserviceaccount).
- Verify that the GCE virtual machine instance is running as the service account that you created. For more information, refer to [setting up an instance to run as a service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#using).
- Allow access to the specified API scope.

For more information about creating and enabling service accounts for GCE instances, refer to [enabling service accounts for instances in Google documentation](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).

### Service account impersonation

You can also configure the plugin to use [service account impersonation](https://cloud.google.com/iam/docs/service-account-impersonation).
You need to ensure the service account used by this plugin has the `iam.serviceAccounts.getAccessToken` permission. This permission is in roles like the [Service Account Token Creator role](https://cloud.google.com/iam/docs/roles-permissions/iam#iam.serviceAccountTokenCreator) (roles/iam.serviceAccountTokenCreator). Also, the service account impersonated by this plugin needs [Monitoring Viewer](https://cloud.google.com/iam/docs/roles-permissions/monitoring#monitoring.viewer).
