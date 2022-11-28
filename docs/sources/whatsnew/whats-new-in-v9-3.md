---
_build:
  list: false
aliases:
  - /docs/grafana/latest/guides/whats-new-in-v9-3/
description: Feature and improvement highlights for Grafana v9.3
keywords:
  - grafana
  - new
  - documentation
  - '9.3'
  - release notes
title: What's new in Grafana v9.3
weight: -33
---

# What’s new in Grafana v9.3 (Beta)

Welcome to Grafana v9.3. If you’d prefer to dig into the details, check out the complete [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## What's New feature template

Use this template to add your what's new section.

[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]

Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).

Add a screenshot to the [website/static/static/img/docs](https://github.com/grafana/website/tree/master/static/static/img/docs) folder and link to it here.

## Geomap panel

Generally available in Grafana Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced

We have added a new alpha layer type in Geomap called photo layer. This layer enables you to render a photo at each data point. To learn more about the photo layer and the geomap panel, see the [documentation]({{< relref "../panels-visualizations/visualizations/geomap/#photos-layer-alpha" >}}).

{{< figure src="/static/img/docs/geomap-panel/geomap-photos-9-3-0.png" max-width="750px" caption="Geomap panel photos layer" >}}

## Canvas panel

Available in beta in Grafana Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced

We have added icon value mapping support. This enables you to dynamically set which icon to display based on your data. To learn more about the Canvas panel, see the [documentation]({{< relref "../panels-visualizations/visualizations/canvas" >}}).

{{< video-embed src="/static/img/docs/canvas-panel/canvas-icon-value-mapping-support-9-3-0.mp4" max-width="750px" caption="Canvas panel icon value mapping support" >}}

## Public Dashboards - Audit Table

Available in experimental in Grafana Open Source, Enterprise, Cloud Pro, Cloud Advanced

We have a new feature as part of our Public Dashboard efforts. We have introduced a new menu item under Dashboards → Public Dashboards. This new view is a list of all of the public dashboards in your Grafana instance. From here you can navigate to the underlying dashboard, see if it is enabled, get a quick link out to the public version of the dashboard, or get quick access to the configuration. You will be able to see a dashboard if you have view access, you will be able to navigate to the configuration if you have public dashboard privileges (RBAC “Dashboard Public” or ADMIN basic).

[image public-dashboard-audit-table.png]

## Public Dashboards - Annotations

Available in experimental in Grafana Open Source, Enterprise, Cloud Pro, Cloud Advanced

Annotations are now supported in public dashboards, with the exception of query annotations. They are turned off by default, but can be turned on in the public dashboard settings modal.

## Transformations - Partition by values

Available in experimental in Grafana Open Source, Enterprise, Cloud Pro, Cloud Advanced

This new transformation can help eliminate the need for multiple queries to the same datasource with different WHERE clauses when graphing multiple series. Consider a metrics SQL table with the following data:

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | US     | 1327  |
| 2022-10-20 01:00:00 | EU     | 912   |

Prior to v9.3. if you wanted to plot a red trendline for US and a blue one for EU in the same TimeSeries panel, you would likely have to split this into two queries:

```
   SELECT Time, Value FROM metrics WHERE Time > ‘2022-10-20’ AND Region=’US’
   SELECT Time, Value FROM metrics WHERE Time > ‘2022-10-20’ AND Region=’EU’
```

This also requires you to know ahead of time which regions actually exist in the metrics table.

With the Partition by values transformer, you can now issue a single query and split the results by unique (enum) values from one or more columns (fields) of your choosing. In this case, Region.

```
   SELECT Time, Region, Value FROM metrics WHERE Time > ‘2022-10-20’
```

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 01:00:00 | US     | 1327  |

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | EU     | 912   |

## Reporting: Zoom in and out to fit your data better into a PDF

This feature is available in Grafana Enterprise, Cloud Pro, and Cloud Advanced.

Because dashboards appear on a screen and reports are PDFs, it can be challenging to render data just the way you want to. Sometimes the report doesn't show enough columns in a table, or the titles appear too small. Now you can adjust the scale of your report to zoom in and make each text field and panel larger or zoom out to show more data.

The zoom feature is located in the **Format Report** section of your reporting configuration. To learn more about reporting, refer to [Create and manage reports]({{< relref "../dashboards/create-reports/">}}).

{{< figure src="/static/img/docs/enterprise/reports/report-zoom.png" max-width="750px" caption="Report zoom feature with PDF documents at three different zoom levels" >}}

## Authentication - OAuth token handling improvements

This feature is generally available in Grafana Open Source, Enterprise, Cloud Free, Cloud Pro, and Cloud Advanced.

As part of our efforts to improve the security of Grafana, we are introducing a long-awaited feature which enhances Grafana's OAuth 2.0 compatibility. When a user logs in using an OAuth provider, on each request Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the refresh token provided (if any exists) to obtain a new access token.

This feature introduces a breaking change, thus it is behind the `accessTokenExpirationCheck` feature toggle and it is disabled by default. Enabling this functionality without configuring refresh tokens for the specific OAuth provider would get users logged out after their access token has expired and they would need to log in again.

Complete documentation on how to configure obtaining a refresh token can be found on the [authentication configuration page]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}}), in the instructions for your Oauth identity provider.

## Grafana CLI tool user management of conflicts

This new CLI command allows you to resolve user identity conflicts of users within Grafana. The email or login field are case sensitive which can cause two or more accounts created for the same user which we call a user identity conflict. You can now resolve these accounts using this CLI tool.

> Note “As a Grafana Cloud user, there are no user identity conflicts, or if you are running a Grafana instance with MySQL.”

```bash
# lists all the conflicting users
$ grafana-cli user-manager conflicts list

# creates a conflict patch file to edit
$ grafana-cli user-manager conflicts generate-file

# reads edited conflict patch file for validation
$ grafana-cli user-manager conflicts validate-file <filepath>

# ingests the conflict users file. Can be executed once per file and will change the state of the database.
$ grafana-cli user-manager conflicts ingest-file <filepath>
```

## LDAP - Role mapping improvements

If you use an LDAP directory to authenticate to Grafana but prefer to assign organizations and roles in the Grafana UI
or via API, you can now enable a configuration option to skip user organization roles synchronization with your LDAP
directory.

Use the [`skip_org_role_sync` LDAP authentication configuration option]({{< relref
"../setup-grafana/configure-security/configure-authentication/ldap/#disable-org-role-synchronization" >}})
when configuring LDAP authentication to prevent the synchronization between your LDAP groups and organization roles
and make user roles editable manually.

## Azure AD OAuth2 - New option to always fetch groups from the Graph API

If you use Azure AD OAuth2 authentication and use `SecurityEnabled` groups that you don't want Azure to embed in the
authentication token, you can force Grafana to use Microsoft's Graph API instead.

Use the [`force_use_graph_api` configuration option]({{< relref
"../setup-grafana/configure-security/configure-authentication/azuread/#force-fetching-groups-from-microsoft-graph-api" >}})
when configuring Azure AD authentication to force Grafana to fetch groups using Graph API.

## RBAC - List token's permissions

We added a new endpoint to help users diagnose permissions-related issues with user and token authorization.
[This endpoint]({{< relref "../developers/http_api/access_control/#list-your-permissions" >}}) allows users to get the
full list of RBAC permissions associated with their token.

For more details, see the related service accounts [documentation]({{< relref
"../administration/service-accounts/#debug-the-permissions-of-a-service-account-token" >}}).

## Terraform - Extended support for provisioning permissions

All Grafana users can now use the latest release of [Terraform's Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) (version 1.31.1+) to provision [user and team access to service accounts](https://grafana.com/docs/grafana/latest/administration/service-accounts/#manage-users-and-teams-permissions-for-a-service-account-in-grafana). This allows full management of service accounts through Terraform - from creating a service account and allowing users to access it to assigning roles to the service account and generating service account tokens.

Grafana Enterprise and Cloud Pro and Advanced users can now provision [access to data sources](https://grafana.com/docs/grafana/latest/administration/data-source-management/#data-source-permissions) for Grafana's `Viewer`, `Editor` and `Admin` basic roles, as well as assign `Edit` permission.

We have also added [documentation on provisioning RBAC roles and role assignments](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-terraform-provisioning/) to guide our Grafana Enterprise and Cloud Pro and Advanced users through this process.

Finally, we have fixed several access control related bugs to ensure a smoother provisioning experience.

## Alerting - Email templating

Available in Grafana Open Source.

Improves the design and functionality of email templates to make template creation much easier and customizable. The email template framework utilizes MJML to define and compile the final email HTML output. Sprig functions in the email templates provide more customizable template functions.

## Alerting - Support for Webex Teams

Available in Grafana Open Source.

Adds Cisco Webex Teams as a contact point type to enable users of Webex Temas to notify alerts into a Webex Teams channel.

## Alerting - Edit alert rules created using the provisioning API

Available in Grafana Open Source.

Enables you to edit API-provisioned alert rules from the Grafana UI. Add the x-disable-provenance header to the following requests when creating or editing your alert rules in the API:

POST /api/v1/provisioning/alert-rules

PUT /api/v1/provisioning/alert-rules/{UID}

## Alerting - Support values in notification templates

Available in Grafana Open Source.

Supports values in notification templates, so that you can create a single template that prints the annotations, labels, and values for your alerts in a format of your choice.

## Alerting - Evaluation intervals

Available in Grafana Open Source.

Makes it easier to set up or update evaluation intervals for alert groups by improving the Alert Rule form.

## Alerting - View notification errors

Available in Grafana Open Source.

Allows you to easily see when something is wrong with your contact point(s) and the reason for the error. The Receivers API contains information on the error, including a time stamp, duration of the attempt, and the error. On the UI, you can view the errors for each contact point.

## Alerting - Redesign of the expressions pipeline

Available in Grafana Open Source.

Introduces a new redesigned expressions pipeline editor that combines both the expressions editor and the preview into a single view.

## New navigation

_Available in beta in all editions._

Use Grafana’s redesigned navigation to get full visibility into the health of your systems, by quickly jumping between features as part of your incident response workflow.

As Grafana has grown from a visualization tool to an observability solution, we’ve added many tools along the way. This often resulted in pages that were visually inconsistent or hard to find. This update gives Grafana a new look and feel, and makes page layouts and navigation patterns more consistent.

We’ve revamped the navigation menu and grouped related tools together, making it easier to find what you need. Pages in Grafana now leverage new layouts that include breadcrumbs and a sidebar, allowing you to quickly jump between pages. We’ve also introduced a header that appears on all pages in Grafana, making dashboard search accessible from any page.

Use the `topnav` feature toggle to try out Grafana’s new navigation.

**Note:** The Grafana documentation has not yet been updated to reflect changes to the navigation.

## New languages

_Generally available in all editions._

We have added 4 new languages to Grafana: Spanish, French, German and Simplified Chinese.

With millions of users across the globe, Grafana has a global footprint. In order to make it accessible to a wider audience, we have taken the first steps in localizing key workflows. You can now set Grafana’s language for the navigation, viewing dashboards, and a handful of settings.

Read more about configuring the [default language for your organization](https://grafana.com/docs/grafana/latest/administration/organization-preferences/) and [updating your profile](https://grafana.com/docs/grafana/latest/administration/user-management/user-preferences/).
