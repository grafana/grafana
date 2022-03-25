+++
title = "Add service account token to a service account"
aliases = ["docs/sources/administration/service-accounts/add.md"]
weight = 30
+++

# Create Service account token

You can add a token to service account in the service account tab of the organization.

Before you begin:

- Ensure you have added the feature toggle for service accounts `service-accounts`
- You have to have the permission to create service accounts
- You have to have the permission to edit service accounts
- You have created a service account

To add token to a service account:

1. Hover your mouse over the organization icon in the sidebar.
1. Click Service accounts. Grafana opens the Service accounts tab.
1. Click on the service account you want to add token to. Grafana opens a detailed view of the service account.
1. Click on the **Add Token** button.
1. Optionally enter a name for the token that will be the name of the token and you can set an expiry date for the token.
1. Optionally enter an expiry date and expiry date for the token or leave it on no expiry date option.
1. Finally click **Generate token**.
