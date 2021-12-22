+++
title = "Authentication"
description = "Google authentication"
keywords = ["grafana", "google", "authentication"]
aliases = ["/docs/grafana/next/datasources/cloudmonitoring/"]
weight = 5
+++

# Google authentication

Requests from a Grafana plugin to Google are made on behalf of an IAM role or an IAM user. The IAM user or IAM role must have the associated policies to perform certain API actions. Since these policies are specific to each data source, refer to the data source documentation for details.

All requests to Google APIs are performed on the server side by the Grafana backend.

There are two ways to authenticate a Grafana plugin to Google- either by uploading a Google JWT file, or by automatically retrieving credentials from Google metadata server. The latter option is only available when running Grafana on GCE virtual machine.

## Using Google Service Account Key File

To authenticate the Grafana plugin with the Google API, you need to create a Google Cloud Platform (GCP) Service Account for the Project you want to show data for. A Grafana data source integrates with one GCP Project. If you want to visualize data from multiple GCP Projects, then you need to create one data source per GCP Project.

### Create a GCP Service Account for a Project

1. Navigate to the [APIs and Services Credentials page](https://console.cloud.google.com/apis/credentials).
1. Click on the **Create credentials** dropdown/button and select the **Service account** option.
1. In **Service account name**, enter a name for the account.
1. From the **Role** dropdown, choose the roles required by the specific plugin.
1. Click **Done**.
1. Use the newly created account to [create a service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys#iam-service-account-keys-create-console). A JSON key file is created and downloaded to your computer.
1. Store this file in a secure place as it allows access to your Google data.
1. Upload the key to Grafana via the data source configuration page.
   The file contents will be encrypted and saved in the Grafana database. Don't forget to save the file after uploading!

## Using GCE Default Service Account

If Grafana is running on a Google Compute Engine (GCE) virtual machine, it is possible for Grafana to automatically retrieve default credentials from the metadata server. This has the advantage of not needing to generate a private key file for the service account and also not having to upload the file to Grafana. However for this to work, there are a few preconditions that need to be met.

1. First of all, you need to create a Service Account that can be used by the GCE virtual machine. For more information, refer to [Create new service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#createanewserviceaccount).
1. Make sure the GCE virtual machine instance is being run as the service account that you just created. For more information, refer to [setting up an instance to run as a service account](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances#using).
1. Allow access to the specified API scope.

For more information about creating and enabling service accounts for GCE VM instances, refer to [enabling service accounts for instances](https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances).
