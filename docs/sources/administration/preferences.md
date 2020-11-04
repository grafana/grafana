+++
title = "Change your preferences"
description = "How to change your Grafana preferences"
keywords = ["grafana", "profile", "change", "preferences"]
type = "docs"
[menu.docs]
identifier = "preferences"
parent = "administration"
weight = 200
+++

# Change your Grafana preferences

You can perform several tasks in the Preferences tab. You can edit your profile, change your Grafana preferences, and view information about your profile and Grafana usage.

## Edit your Grafana profile

Your profile includes your name, user name, and email address.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. In the Edit Profile section, you can edit any of the following:
   - **Name -** Edit this field to change the display name associated with your profile.
   - **Email -** Edit this field to change the email address associated with your profile.
   - **Username -** Edit this field to change your user name.
1. Click **Save**.

## Edit your Grafana preferences

Your Grafana preferences include whether uses the dark or light theme, your home dashboard, and your timezone.

> **Note:** Settings on your personal instance override settings made by your administrator at the instance or team level.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. In the Preferences section, you can edit any of the following:
   - **UI Theme -** Click to set the **Dark** or **Light** to select a theme. **Default** is either the dark theme or the theme selected by your Grafana administrator.
   - **Home Dashboard -** Refer to [Set your personal home dashboard]({{< relref "change-home-dashboard.md#set-your-personal-home-dashboard" >}}) for more information.
   - **Timezone -** Click to select an option in the **Timezone** list. **Default** is either the browser local timezone or the timezone selected by your Grafana administrator. Refer to [Time range controls]({{< relref "../dashboards/time-range-controls.md" >}}) for more information about Grafana time settings.
1. Click **Save**.

## View your assigned organizations

Every user is a member of at least one organization. You can have different roles in every organization that you are a member of.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. Scroll down to the Organizations section.
   - **Name -** The name of the organizations you are a member of in that Grafana instance.
   - **Role -** The role you are assigned in the organization. Refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}) about permissions assigned to each role.
   - **Current -** Grafana tags the organization that you are currently signed in to as _Current_.

## View your Grafana sessions

Grafana logs your sessions in each Grafana instance. You can review this section if you suspect someone has misused your Grafana credentials.

1. Navigate to the Preferences tab. Hover your cursor over your user icon in the lower left corner of the screen, and then click **Preferences.**
1. Scroll down to the Sessions section. Grafana displays the following:
   - **Last seen -** How long ago you logged on.
   - **Logged on -** The date you logged on to the current Grafana instance.
   - **IP address -** The IP address that you logged on from.
   - **Browser & OS -** The web browser and operating system used to log on to Grafana.
   - If you are a Grafana Admin for the instance, then you can revoke a session by clicking the red signout icon in the session row.
