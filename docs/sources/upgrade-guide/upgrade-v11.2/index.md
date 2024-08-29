---
description: Guide for upgrading to Grafana v11.2
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '11.2'
title: Upgrade to Grafana v11.2
menuTitle: Upgrade to v11.2
weight: 1000
---

# Upgrade to Grafana v11.2

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Ensure that your Datasource UIDs are following the correct standard

We have had a standard ways to define UIDs for Grafana objects for years (at least [since Grafana 5](https://github.com/grafana/grafana/issues/7883)). While all of our internal code is complying to this format we did not yet had strict enforcement of this format in rest APIs and provisioning paths that allow creation and update of datasources.

In Grafana `11.1` we have [introduced](https://github.com/grafana/grafana/pull/86598) a warning that is sent to grafana server logs every time a datasource instance is being created or updated that is using an invalid UID format. 

In Grafana `11.2` we are [adding](https://github.com/grafana/grafana/pull/89363/files) a new feature flag called `failWrongDSUID` that is turned off by default. When enabled the rest APIs and provisioning will start rejecting and requests to create or update datasource instances that have wrong UID.

In Grafana `11.5` we are going to turn feature flag `failWrongDSUID` on by default, there will still be an option to turn it off.

In Grafana `12` we are going to make this a default behaviour that can not be changed via configuration.

### Correct UID format
You can find the exact regex definition [here](https://github.com/grafana/grafana/blob/c92f5169d1c83508beb777f71a93336179fe426e/pkg/util/shortid_generator.go#L32-L45). 

A datasource UID can only contain:
- latin characters (`a-Z`)
- numbers (`0-9`)
- dash symbols (`-`)

### How can I know if I am affected?
- You can fetch all your datasources via `/api/datasources` API ([docs](https://grafana.com/docs/grafana/latest/developers/http_api/data_source/#get-all-data-sources)) and looking into `uid` fields comparing it to the correct format. Here is a script that could help, it is missing authentication that you would [have to add yourself](https://grafana.com/docs/grafana/latest/developers/http_api/#authenticating-api-requests).

```
curl http://localhost:3000/api/datasources | jq '.[] | select((.uid | test("^[a-zA-Z0-9\\-_]+$") | not) or (.uid | length > 40)) | {id, uid, name, type}'
```
- Another option is to inspect server logs for `Invalid datasource uid` ([reference](https://github.com/grafana/grafana/blob/68751ed3107c4d15d33f34b15183ee276611785c/pkg/services/datasources/service/store.go#L429))

### What can I do if I am affected?
You would have to create a new datasource with correct UID and switch to using it in your dashboards and alert rules.

### How can I update my dashboards to use the new / or updated datasource?
1. Go to the dashboard that is using this datasource and change it to the new / updated on in the datasource picker below your panel 
2. Update dashboard's JSON model directly via search and replace. Navigate to [dashboard json model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/) and carefully replace all the instances of old `uid` with the newly created `uid`. 

{{< figure src="/media/docs/grafana/screenshot-grafana-11-datasource-uid-enforcement.png" alt="Updating JSON Model of a Dashboard">}}

### How can I update my alert rules to use the new / or updated datasource?
Open the alert rule you want to adjust and search for the datasource that is being used for the query / alert condition. There you should be able to pick the new datasource from the dropdown and save the alert rule.

## Technical notes
 