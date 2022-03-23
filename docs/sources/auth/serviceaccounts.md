+++
title = "Service accounts"
description = "Grafana Service accounts"
keywords = ["grafana", "serviceaccounts", "documentation", "serviceaccounts-auth"]
aliases = ["/docs/grafana/latest/auth/serviceaccounts/"]
weight = 1100
+++

# Service accounts

A Service account is generally a regular user account, but used to run automated or compute workload which are intended for programmatic use either internally for a Grafana feature or through an API key. Applications use service accounts to make authorized API calls, authorized as the service account itself.

A common use case for creating a service account is to perform operations on automated or triggered tasks. Such tasks include reporting, alerting rules, syncing user groups or pure machine to machine communication. Similarly the service account could be set up to manage users and permissions across the organization to an external auth provider. It can also be used in combination with FGAC to grant specific scopes. Customers also use service accounts to gather all api keys within a specific domain.

A service account can be associated with multiple api keys. As a result, we recommend starting off by creating one service account per use case.

> **Note:** Service accounts act on an organization level, if you have the same task that is needed for multiple organizations, we recommend provisioning service accounts via terraform.

Service accounts differ key takeaways:

- A service account is identified by its name, which is unique to the entire suite of organizations. The name is set upon creation of the service account.
- Service accounts do not have passwords, and cannot log in via browsers or cookies.
- Service accounts are associated with private/public RSA key-pairs that are used for authentication to Grafana.
- Service accounts live on a organizational level and are restricted as such
