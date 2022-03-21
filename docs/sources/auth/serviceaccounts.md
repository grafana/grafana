+++
title = "Service accounts"
description = "Grafana Service accounts"
keywords = ["grafana", "serviceaccounts", "documentation", "serviceaccounts-auth"]
aliases = ["/docs/grafana/latest/auth/serviceaccounts/"]
weight = 1100
+++

// In terms of docs, it's super important that we explain 'what' a service and account is and 'why' it's important. Provide a business reason for using them and what are the benefits.

# Service accounts

A service account is a special kind of user used by an application or compute workload, which are intended for programmatic use either internally for a Grafana feature or through an API key. Applications use service accounts to make authorized API calls, authorized as the service account itself.

A service account is identified by its login name, which is unique to the entire suite of organizations. The name is set upon creation of the service account.

A service account can be used to setup scheduled workloads, which are then used to make authorized API calls. Similiarly the service account could be setup to manage users and permissions across the organization to an external auth provider or similiar. It can also be used to grant specific operations, such as api calls to external parties. Customers also use service accounts to gather all apikeys within a specific domain.

Service accounts differ from user accounts in a few key ways:

- Service accounts do not have passwords, and cannot log in via browsers or cookies.
- Service accounts are associated with private/public RSA key-pairs that are used for authentication to Grafana.
- Service accounts live on a organizational level and are restricted as such
