+++
title = "User account tasks"
weight = 400
+++

# User account tasks



## Edit your Grafana profile

Your profile includes your name, user name, and email address.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. In the Edit Profile section, you can edit any of the following:
   - **Name -** Edit this field to change the display name associated with your profile.
   - **Email -** Edit this field to change the email address associated with your profile.
   - **Username -** Edit this field to change your user name.
1. Click **Save**.

## View your assigned organizations

Every user is a member of at least one organization. You can have different roles in every organization that you are a member of.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. Scroll down to the Organizations section.
   - **Name -** The name of the organizations you are a member of in that Grafana instance.
   - **Role -** The role you are assigned in the organization. Refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) about permissions assigned to each role.
   - **Current -** Grafana tags the organization that you are currently signed in to as _Current_. If you are part of multiple organizations, then you can click **Select** to switch to that organization.

## Change the organization you are signed in to

When you sign in to Grafana, you are always signed in with a particular organization. If you are assigned to multiple organizations, then you might need to switch which organization you are signed in to. For example, if you need to view a dashboard associated with a different org, then you might switch organizations.

1. Hover your cursor over your user icon in the lower left corner of the screen, then click **Switch**.
1. Next to the organization that you want to sign in to, click **Switch to**.

## View your Grafana sessions

Grafana logs your sessions in each Grafana instance. You can review this section if you suspect someone has misused your Grafana credentials.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. Scroll down to the Sessions section. Grafana displays the following:
   - **Last seen -** How long ago you logged on.
   - **Logged on -** The date you logged on to the current Grafana instance.
   - **IP address -** The IP address that you logged on from.
   - **Browser & OS -** The web browser and operating system used to log on to Grafana.
   - If you are a Grafana Admin for the instance, then you can revoke a session by clicking the red signout icon in the session row.