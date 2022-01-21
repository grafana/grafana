+++
title = "Add a user"
aliases = ["path here"]
weight = 70
+++

# Add a user

Add users when you want to provide individuals with access to Grafana.

When you create a user, the system assigns the user viewer permissions in a default organization, which you can change.

<!--- Is there a limit to the number of user created for OSS? -->

<!--- Do orgs need to be created before users? Or does Main Org come out of the box? -->

## Before you begin

- Ensure that you have Grafana server administrator privileges

**To add a user**:

1. Sign in to Grafana as a system administrator.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-user-list.md" >}}

1. Click **New user**.
1. Complete the fields and click **Create user**.
   {{< /docs/list >}}

<!--- Is the user made aware that they have been added? Through email maybe? -->

You can now add the user to an organization. For more information, refer to [Add a user to an organization]({{< relref "./add-user-to-org.md">}}).
