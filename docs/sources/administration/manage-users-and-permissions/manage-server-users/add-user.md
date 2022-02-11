+++
title = "Add a user"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-server-users/add-user.md"]
weight = 10
+++

# Add a user

Add users when you want to manually provide individuals with access to Grafana.

When you create a user using this method, you must create their password  and they do not receive a notification by email. To invite a user to Grafana and allow them to create their own password, [invite a user to join  an organization]({{< relref "../manage-org-users/invite-user-join-org.md">}}).

## Before you begin

- Ensure that you have Grafana server administrator privileges

**To add a user**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click **New user**.
1. Complete the fields and click **Create user**.

When you create a user, the system assigns the user viewer permissions in a default organization, which you can change. You can now [add a user to a second organization]({{< relref "./add-user-to-org.md">}}).
