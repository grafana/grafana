---
title: Create users and teams
summary: Learn how to set up teams and users.
description: Learn how to set up teams and users.
id: create-users-and-teams
categories: ['administration']
tags: ['beginner']
status: Published
authors: ['grafana_labs']
Feedback Link: https://github.com/grafana/tutorials/issues/new
weight: 20
---

## Introduction

This tutorial is for admins or anyone that wants to learn how to manage
users in Grafana. You'll add multiple local users, organize them into teams,
and make sure they're only able to access the resources they need.

### Scenario

_Graphona_, a fictional telemarketing company, has asked you to configure Grafana
for their teams.

In this scenario, you'll:

- Create users and organize them into teams.
- Manage resource access for each user and team through roles and folders.

{{% class "prerequisite-section" %}}

### Prerequisites

- Grafana 7.0 or newer, this tutorial was tested with Grafana 8.5.
- A user with the Admin or Server Admin role.
  {{% /class %}}

## Add users

In Grafana, all users are granted an _organization role_ that determines what
resources they can access.

There are three types of organization roles in Grafana. The **Grafana Admin** is
a global role, the default `admin` user has this role.

- **Grafana Admin -** Manage organizations, users, and view server-wide settings.
- **Organization Administrator -** Manage data sources, teams, and users within an organization.
- **Editor -** Create and edit dashboards.
- **Viewer -** View dashboards.

{{% admonition type="note" %}}
You can also configure Grafana to allow [anonymous access](/docs/grafana/latest/auth/overview/#anonymous-authentication), to make dashboards available even to those who don't have a Grafana user account. That's how Grafana Labs made https://play.grafana.org publicly available.
{{% /admonition %}}

### Exercise

Graphona has asked you to add a group of early adopters that work in the Marketing and Engineering teams. They'll need to be able to edit their own team's dashboards, but want to have view access to dashboards that belong to the other team.

| Name              | Email                         | Username          |
| ----------------- | ----------------------------- | ----------------- |
| Almaz Russom      | almaz.russom@example.com      | almaz.russom      |
| Brenda Tilman     | brenda.tilman@example.com     | brenda.tilman     |
| Mada Rawdha Tahan | mada.rawdha.tahan@example.com | mada.rawdha.tahan |
| Yuan Yang         | yuan.yang@example.com         | yuan.yang         |

#### Add users

Repeat the following steps for each of the employees in the table above to create the new user accounts:

1. Log in as a user that has the **Server Admin** role.
1. On the sidebar, click the **Server Admin** (shield) icon.
1. Choose **Users** from the menu drop-down, then click **New User**.
1. Enter the **Name**, **Email**, **Username**, and **Password** from the table above.
1. Click the **Create User** button to create the account.

When you create a user they are granted the Viewer role by default, which means that they won't be able to make any changes to any of the resources in Grafana. That's ok for now, you'll grant more user permissions by adding users to _teams_ in the next step.

## Assign users to teams

Teams let you grant permissions to a group of users, instead of granting permissions to individual users one at a time.

Teams are useful when onboarding new colleagues. When you add a user to a team, they get access to all resources assigned to that team.

### Exercise

In this step, you'll create two teams and assign users to them.

| Username          | Team        |
| ----------------- | ----------- |
| brenda.tilman     | Marketing   |
| mada.rawdha.tahan | Marketing   |
| almaz.russom      | Engineering |
| yuan.yang         | Engineering |

#### Create a team

Create the _Marketing_ and _Engineering_ teams.

1. In the sidebar, hover your mouse over the **Configuration** (gear) icon and
   then click **Teams**.
1. Click **New team**.
1. In **Name**, enter the name of the team: either _Marketing_ or _Engineering_.
   You do not need to enter an email.
1. Click **Create**.
1. Click on the **Teams** link at the top of the page to return to teams page and create the second team.

#### Add a user to a team

Repeat these steps for each user to assign them to their team. Refer to the table above for team assignments.

1. Click the team name _Marketing_ or _Engineering_ to add members to that team.
1. Click **Add member**.
1. In the **Add team member** box, click the drop-down arrow to choose the user you want to add to the team .
1. Click **Add to team**.

When you're done, you'll have two teams with two users assigned to each.

## Manage resource access with folders

It's a good practice to use folders to organize collections of related dashboards. You can assign permissions at the folder level to individual users or teams.

### Exercise

The Marketing team is going to use Grafana for analytics, while the Engineering team wants to monitor the application they're building.

You'll create two folders, _Analytics_ and _Application_, where each team can add their own dashboards. The teams still want to be able to view each other's dashboards.

| Folder      | Team        | Permissions |
| ----------- | ----------- | ----------- |
| Analytics   | Marketing   | Edit        |
|             | Engineering | View        |
| Application | Marketing   | View        |
|             | Engineering | Edit        |

Repeat the following steps for each folder. You'll move through all three steps for each folder before moving on to the next one.

#### Add a folder for each team

1. In the sidebar, hover your cursor over the **Dashboards** (four squares) icon and then click **Browse**.
1. To create a folder, click **New Folder**.
1. In **Name**, enter the folder name.
1. Click **Create**.
1. Stay in the folder view and move on to the next sections to edit permissions for this folder.

#### Remove the viewer role from folder permissions

By default, when you create a folder, all users with the Viewer role are granted permission to view the folder.

In this example, Graphona wants to explicitly grant teams access to folders. To support this, you need to remove the Viewer role from the list of permissions:

1. Go to the **Permissions** tab.
1. Remove the Viewer role from the list, by clicking the red button on the right.
1. Stay in the permissions tab and move on to the next section to grant folder permissions for each team.

#### Grant folder permissions to a team:

1. Click **Add Permission**.
1. In the **Add Permission For** dialog, make sure "Team" is selected in the first box.
1. In the second box, select the team to grant access to.
1. In the third box, select the access you want to grant.
1. Click **Save**.
1. Repeat for the other team.
1. Click the **Dashboards** link at the top of the page to return to the dashboard list.

When you're finished, you'll have two empty folders, the contents of which can only be viewed by members of the Marketing or Engineering teams. Only Marketing team members can edit the contents of the Analytics folder, only Engineering team members can edit the contents of the Application folder.

## Define granular permissions

By using folders and teams, you avoid having to manage permissions for individual users.

However, there are times when you need to configure permissions on a more granular level. For these cases, Grafana allows you to override permissions for specific dashboards.

### Exercise

Graphona has hired a consultant to assist the Marketing team. The consultant should only be able to access the SEO dashboard in the Analytics folder.

| Name       | Email                            | Username   |
| ---------- | -------------------------------- | ---------- |
| Luc Masson | luc.masson@exampleconsulting.com | luc.masson |

#### Add a new user

1. In the sidebar, click the **Server Admin** (shield) icon.
1. In the Users tab, click **New user**.
1. In **Name**, enter the name of the user.
1. In **E-mail**, enter the email of the user.
1. In **Username**, enter the username that the user will use to log in.
1. In **Password**, enter a password. The user can change their password once they log in.
1. Click **Create user** to create the user account.

#### Create a dashboard

1. In the sidebar, click the **Create** (plus) icon to create a new dashboard.
1. In the top right corner, click the cog icon to go to **Dashboard settings**.
1. In **Name**, enter **SEO**.
1. Click **Save Dashboard**.
1. In the **Save dashboard as...** pop-up, choose the **Analytics** folder from the drop-down and click **Save**.

#### Grant a user permission to view dashboard

1. In the top right corner of your dashboard, click the cog icon to go to **Dashboard settings**.
1. Go to the **Permissions** tab, and click **Add Permission**.
1. In the **Add Permission For** dialog, select **User** in the first box.
1. In the second box, select the user to grant access to: Luc Masson.
1. In the third box, select **View**.
1. Click **Save**.
1. Click **Save dashboard**.
1. Add a note about giving Luc Masson Viewer permission for the dashboard and then click **Save**.

You've created a new user and given them unique permissions to view a single dashboard within a folder.

#### Check your work

You can repeat these steps to log in as the other users you've created see the differences in the viewer and editor roles.

For this example, you can log in as the user `luc.masson` to see that they can only access the SEO dashboard.

1. Click the profile (avatar) button in the bottom left corner, choose **Sign out**.
1. Enter `luc.masson` as the username.
1. Enter the password you created for Luc.
1. Click **Log in**.
1. In the sidebar, hover your cursor over the **Dashboards** (four squares) icon and then click **Browse**.
1. You'll notice that you won't see the **Analytics** folder in the folder view because we did not give Luc folder permission.
1. Click on the list icon (3 lines) to see the dashboard list.
1. Click on the **SEO dashboard**, there shouldn't be any editing permissions since we assigned Luc the viewer role.

## Summary

In this tutorial, you've configured Grafana for an organization:

- You added users to your organization.
- You created teams to manage permissions for groups of users.
- You configured permissions for folders and dashboard.

### Learn more

- [Organization Roles](/docs/grafana/next/administration/manage-users-and-permissions/about-users-and-permissions/#organization-roles)
- [Permissions Overview](/docs/grafana/latest/administration/manage-users-and-permissions/about-users-and-permissions/#about-users-and-permissions)
