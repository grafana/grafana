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

## Technical notes

### Grafana data source UID format enforcement

**Ensure that your data source UIDs follow the correct standard**

We've had a standard ways to define UIDs for Grafana objects for years (at least [since Grafana v5](https://github.com/grafana/grafana/issues/7883)). While all of our internal code complies to this format, we didn't yet have strict enforcement of this format in REST APIs and provisioning paths that allow the creation and update of data sources.

In Grafana v11.1, we [introduced](https://github.com/grafana/grafana/pull/86598) a warning that is sent to Grafana server logs every time a data source instance is being created or updated using an invalid UID format.

In Grafana v11.2, we [added](https://github.com/grafana/grafana/pull/89363/files) a new feature flag called `failWrongDSUID` that is turned off by default. When enabled, the REST APIs and provisioning start rejecting any requests to create or update data source instances that have an incorrect UID.

In Grafana v11.5, we're going to turn feature flag `failWrongDSUID` on by default, but there will still be an option to turn it off.

In Grafana v12, this will be the default behavior and will not be configurable.

#### Correct UID format

You can find the exact regex definition [in the grafana repository](https://github.com/grafana/grafana/blob/c92f5169d1c83508beb777f71a93336179fe426e/pkg/util/shortid_generator.go#L32-L45).

A data source UID can only contain:

- Latin characters (`a-Z`)
- Numbers (`0-9`)
- Dash symbols (`-`)

#### How do I know if I'm affected?

- You can fetch all your data sources using the `/api/datasources` API. Review the `uid` fields, comparing them to the correct format, as shown [in the docs](https://grafana.com/docs/grafana/latest/developers/http_api/data_source/#get-all-data-sources). Following is a script that can help, but note that it's missing authentication that you [have to add yourself](https://grafana.com/docs/grafana/latest/developers/http_api/#authenticating-api-requests):

```
curl http://localhost:3000/api/datasources | jq '.[] | select((.uid | test("^[a-zA-Z0-9\\-_]+$") | not) or (.uid | length > 40)) | {id, uid, name, type}'
```

- Alternatively, you can check the server logs for the `Invalid datasource uid` [error](https://github.com/grafana/grafana/blob/68751ed3107c4d15d33f34b15183ee276611785c/pkg/services/datasources/service/store.go#L429).

#### What do I do if I'm affected?

You'll need to create a new data source with the correct UID and update your dashboards and alert rules to use it.

#### How do I update my dashboards to use the new or updated data source?

1. Go to the dashboard using the data source and update it by selecting the new or updated data source from the picker below your panel.
1. Update the dashboard's JSON model directly using search and replace.

   Navigate to [dashboard json model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/) and carefully replace all the instances of old `uid` with the newly created `uid`.

   {{< figure src="/media/docs/grafana/screenshot-grafana-11-datasource-uid-enforcement.png" alt="Updating JSON Model of a Dashboard">}}

#### How do I update my alert rules to use the new or updated data source?

Open the alert rule you want to adjust and search for the data source that is being used for the query/alert condition. From there, select the new data source from the drop-down list and save the alert rule.
