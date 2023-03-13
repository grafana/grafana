+++
title = "Change name and email"
keywords = ["grafana", "configuration", "documentation", "home"]
weight = 100
+++

# Change Grafana name and email

In Grafana, you can change your names and emails associated with groups or accounts in the Settings or Preferences. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

## Change organization name

Grafana server administrators and organization administrators can change organization names.

### Grafana Server Admin change organization name

Follow these instructions if you are a Grafana Server Admin.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list.md" >}}

1. In the organization list, click the name of the organization that you want to change.
1. In **Name**, enter the new organization name.
1. Click **Update**.
   {{< /docs/list >}}

### Organization Admin change organization name

If you are an Organization Admin, follow these steps:

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}

1. In **Organization name**, enter the new name.
1. Click **Update organization name**.
   {{< /docs/list >}}

## Change team name or email

Organization administrators and team administrators can change team names and email addresses.
To change the team name or email, follow these steps:

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Teams**. Grafana displays the team list.
1. In the team list, click the name of the team that you want to change.
1. Click the **Settings** tab.
1. In the Team Settings section, you can edit the following:
   - **Name -** Edit this field to change the display name associated with the team.
   - **Email -** Edit this field to change the email address associated with the team.
1. Click **Update**.

## Change user name or email

To learn how to edit your user information, refer to [Edit your profile]({{< relref "../../manage-users/user-admin/user-profile" >}}).
