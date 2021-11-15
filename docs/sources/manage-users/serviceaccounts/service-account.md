+++
title = "What are service accounts"
weight = 200
+++

What are service accounts?
A service account is a special kind of user used by an application or compute workload, which are users that are intended for programmatic use either internally for a Grafana feature or through an API key. Applications use service accounts to make authorized API calls, authorized as the service account itself.

For example, a all reporting could be setup and run as a service account from your application, and that account can be given permissions to access the resources it needs. This way the service account is the identity of the service, and the service account's permissions control which resources the service can access.

A service account is identified by its email address, which is unique to the account.

Differences between a service account and a user account
Service accounts differ from user accounts in a few key ways:

- Service accounts do not have passwords, and cannot log in via browsers or cookies.
- Service accounts are associated with private/public RSA key-pairs that are used for authentication to Grafana.
- You can let other users or service accounts impersonate a service account.
- Service accounts do not belong to your Google Workspace domain, unlike user accounts. If you share Google Workspace assets, like docs or events, with your entire Google Workspace domain, they are not shared with service accounts. Similarly, Google Workspace assets created by a service account are not created in your Google Workspace domain. As a result, your Google Workspace and Cloud Identity admins can't own or manage these assets.
