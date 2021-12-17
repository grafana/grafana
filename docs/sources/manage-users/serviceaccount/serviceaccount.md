+++
title = "What are service accounts"
weight = 200
+++

What are service accounts?

A service account is a special kind of user used by an application or compute workload, which are users that are intended for programmatic use either internally for a Grafana feature or through an API key. Applications use service accounts to make authorized API calls, authorized as the service account itself.

For example, all reporting could be setup and run as a service account from your application, and that account can be given permissions to access the resources it needs. This way the service account is the identity of the service, and the service account's permissions control which resources the service can access.

A service account is identified by its login name, which is unique to the entire suite of organizations. The name is set upon creation of the service account.

Differences between a service account and a user account
Service accounts differ from user accounts in a few key ways:

- Service accounts do not have passwords, and cannot log in via browsers or cookies.
- Service accounts are associated with private/public RSA key-pairs that are used for authentication to Grafana.
- You can let other users or service accounts impersonate a service account.
- Service accounts lives on a organizational level, but it does not restrict them from acting cross organizational, such as adding or editing user information.
