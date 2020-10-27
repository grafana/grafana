+++
title = "Grafana Enterprise"
description = "Grafana Enterprise overview"
keywords = ["grafana", "documentation", "datasource", "permissions", "ldap", "licensing", "enterprise", "insights", "reporting"]
type = "docs"
[menu.docs]
name = "Grafana Enterprise"
identifier = "enterprise"
weight = 100
+++

# Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana, Grafana Enterprise includes [exclusive datasource plugins]({{< relref "#enterprise-plugins">}}) and [additional features]({{< relref "#enterprise-features">}}). On top of that you get 24x7x365 support and training from the core Grafana team.

[Learn more about Grafana Enterprise.](https://grafana.com/enterprise)

## Authentication

Grafana Enterprise includes integrations with more ways to authenticate your users and enhanced authentication capabilities.

### Team sync

[Team sync]({{< relref "team-sync.md" >}}) allows you to set up synchronization between teams in Grafana and teams in your auth provider so that your users automatically end up in the right team.

Supported auth providers:

- [Auth Proxy]({{< relref "../auth/auth-proxy.md#team-sync-enterprise-only">}})
- [Azure AD OAuth]({{< relref "../auth/azuread.md#team-sync-enterprise-only" >}})
- [GitHub OAuth]({{< relref "../auth/github.md#team-sync-enterprise-only" >}})
- [GitLab OAuth]({{< relref "../auth/gitlab.md#team-sync-enterprise-only" >}})
- [LDAP]({{< relref "enhanced_ldap.md#ldap-group-synchronization-for-teams" >}})
- [Okta]({{< relref "../auth/okta.md#team-sync-enterprise-only" >}})
- [SAML]({{< relref "saml.md#configure-team-sync" >}})

### Enhanced LDAP integration

With Grafana Enterprise [enhanced LDAP]({{< relref "enhanced_ldap.md" >}}), you can set up active LDAP synchronization.

### SAML authentication

[SAML authentication]({{< relref "saml.md" >}}) enables your Grafana Enterprise users to authenticate with SAML.

## Enterprise features

With Grafana Enterprise, you get access to new features, including:

- [Data source permissions]({{< relref "datasource_permissions.md" >}}) to restrict query access to specific teams and users.
- [Reporting]({{< relref "reporting.md" >}}) to generate a PDF report from any dashboard and set up a schedule to have it emailed to whoever you choose.
- [Export dashboard as PDF]({{< relref "export-pdf.md" >}})
- [White labeling]({{< relref "white-labeling.md" >}}) to customize Grafana from the brand and logo to the footer links.
- [Usage insights]({{< relref "usage-insights.md" >}}) to understand how your Grafana instance is used.
- [Vault integration]({{< relref "vault.md" >}}) to manage your configuration or provisioning secrets with Vault.
- [Auditing]({{< relref "auditing.md" >}}) tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements.

## Enterprise plugins

With a Grafana Enterprise license, you get access to premium plugins, including:

- [Amazon Timestream](https://grafana.com/plugins/grafana-timestream-datasource)
- [AppDynamics](https://grafana.com/plugins/dlopes7-appdynamics-datasource)
- [DataDog](https://grafana.com/plugins/grafana-datadog-datasource)
- [Dynatrace](https://grafana.com/plugins/grafana-dynatrace-datasource)
- [New Relic](https://grafana.com/plugins/grafana-newrelic-datasource)
- [Oracle Database](https://grafana.com/plugins/grafana-oracle-datasource)
- [ServiceNow](https://grafana.com/grafana/plugins/grafana-servicenow-datasource)
- [Splunk](https://grafana.com/plugins/grafana-splunk-datasource)

## Try Grafana Enterprise

To purchase or obtain a trial license contact the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->