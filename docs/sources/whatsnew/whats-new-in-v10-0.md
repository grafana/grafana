---
description: Feature and improvement highlights for Grafana v10.0
keywords:
  - grafana
  - new
  - documentation
  - '10.0'
  - release notes
title: What's new in Grafana v10.0
weight: -33
---

# What’s new in Grafana v10.0

Welcome to Grafana 10.0! Read on to learn about changes to search and navigation, dashboards and visualizations, and authentication and security. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

<!-- Template below
## Feature
[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## Authentication and authorization

### Role-based access control is always enabled

[Role-based access control (RBAC)](({{< relref "../administration/roles-and-permissions/access-control/" >}})) is now always enabled and you can't disable it anymore using configuration option in Grafana.

We understand that this may affect some users who have relied on the ability to disable role-based access control (RBAC) in the past. However, we believe that this change is necessary to ensure the best possible security and user experience for our community and customers.

Check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.0/index.md" >}}) to check if the change is impacting you and what you can do to mitigate any potential issues.

### SAML UI

You can now configure SAML using our new user interface, making the process easier and more convenient than ever before.
With the new user interface, you can now configure SAML without needing to restart Grafana and you can control access to the configuration UI by using [role-based access control (RBAC)]({{< relref "../administration/roles-and-permissions/access-control/" >}}). which makes the process much faster and more efficient.

The SAML UI is available in all Grafana editions, it is intuitive and user-friendly, with clear instructions and helpful prompts to guide you through the process.

For more information on how to set up SAML using the Grafana UI, refer to [Configure SAML authentication using the Grafana user interface]({{< relref "../setup-grafana/configure-security/configure-authentication/saml-ui/" >}}).

### Case-insensitive usernames and email addresses

Usernames and email addresses are now treated as case-insensitive, which means that you will no longer need to worry about capitalization when logging in or creating an account.

From now on, whether you type your username or email address in uppercase, lowercase, or a combination of both, Grafana will treat them as the same. This will simplify the login process, reduce the risk of typos and identity conflicts when changing authentication providers.

To help you with dealing with potential user identity conflicts, we have built a [Grafana CLI user identity conflict resolver tool](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/) which is available since Grafana 9.3.

Note that if you are running Grafana with MySQL as a database, this change does not have any impact as MySQL users were already treated as case-insensitive.

## Nested folders

_Available in preview in all editions of Grafana._

You can now create nested folders in Grafana to help you better organize your dashboards and alerts. This new feature allows you to create, read, update, and delete nested folders, making it easier to sort resources by business units, departments, and teams.

You can also set up permissions using Role-Based Access Control (RBAC). Folder permissions will cascade, being inherited from the parent folder, which simplifies access management.

It's worth noting that the nested folders feature is currently in preview. As such, it's recommended to enable it only on test or development instances, rather than in production environments.

To try out the nested folders feature, you'll need to enable the `nestedFolders` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for managing dashboards and folders, to provide a more streamlined user experience.

{{< figure src="/media/docs/grafana/screenshot-grafana-10.0-nested-folders.png" max-width="750px" caption="Nested folders in Grafana" >}}
