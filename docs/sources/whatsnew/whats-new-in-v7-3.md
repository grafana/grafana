+++
title = "What's New in Grafana v7.3"
description = "Feature and improvement highlights for Grafana v7.3"
keywords = ["grafana", "new", "documentation", "7.3", "release notes"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/whats-new-in-v7-3/"]
[menu.docs]
name = "Version 7.3"
identifier = "v7.3"
parent = "whatsnew"
weight = -17
+++

# What's new in Grafana v7.3

This topic includes the release notes for Grafana v7.3. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Highlights

Grafana 7.3 comes with a number of features and enhancements:

- [**Google Cloud Monitoring:** Out of the box dashboards]({{< relref "#cloud-monitoring-out-of-the-box-dashboards" >}})
- [**Shorten URL for dashboards and Explore**]({{< relref "#shorten-url-for-dashboards-and-explore" >}})

#### Cloud monitoring out-of-the-box dashboards

The updated Cloud monitoring data source is shipped with pre-configured dashboards for five of the most popular GCP services:

- BigQuery
- Cloud Load Balancing
- Cloud SQL
- Google Compute Engine `GCE`
- Google Kubernetes Engine `GKE`

To import the pre-configured dashboards, go to the configuration page of your Google Cloud Monitoring data source and click on the `Dashboards` tab. Click `Import` for the dashboard you would like to use. To customize the dashboard, we recommend to save the dashboard under a different name, because otherwise the dashboard will be overwritten when a new version of the dashboard is released.

For more details, see the [Google Cloud Monitoring docs]({{<relref "../datasources/cloudmonitoring/#out-of-the-box-dashboards">}})

## Shorten URL for dashboards and Explore

This is an amazing new feature that was created in cooperation with one of our community members. The new **share shortened link** capability allows you to create smaller and simpler URLs of the format `/goto/:uid` instead of using longer URLs that can contain complex query parameters. In Explore, you can create a shortened link by clicking on the share button in Explore toolbar. In the dashboards, a shortened url option is available through the share panel or dashboard button.

## Grafana Enterprise features

These features are included in the Grafana Enterprise edition software.

### Auditing

Auditing tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements. Grafana logs events (as JSON) to file or directly to [loki](/oss/loki/).

Example of a login event:

```json
{
  "timestamp": "2020-10-22T10:18:00.838094347Z",
  "user": {
    "userId": 1,
    "orgId": 1,
    "isAnonymous": false
  },
  "action": "login-grafana",
  "result": {
    "statusType": "success",
    "statusCode": 200
  },
  "requestUri": "/login",
  "ipAddress": "127.0.0.1:41324",
  "userAgent": "Chrome/86.0.4240.111",
  "grafanaVersion": "7.3.0"
}
``` 

For more details, see the [Auditing docs]({{<relref "../enterprise/auditing.md">}}).

### Data source usage insights

Data source usage insights allows you to gain insight into how a data source is being used and how well it works. There is a new tab in the data source settings page called insights that will show you information about how the data source has been used in the past 30 days.

Insights:

- Queries per day
- Errors per day
- Average load duration per day (ms)

### SAML single logout

SAML’s single logout (SLO) capability allows users to log out from all applications associated with the current identity provider (IdP) session established via SAML SSO. For more information, refer to the [docs]({{<relref "../enterprise/saml/#single-logout">}}). 

### SAML IdP-initiated single sign on

IdP-initiated single sign on (SSO) allows the user to log in directly from the SAML identity provider (IdP). It is disabled by default for security reasons. For more information, refer to the [docs]({{<relref "../enterprise/saml/#idp-initiated-single-sign-on-sso">}}). 

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->