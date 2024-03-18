---
description: Breaking changes for Grafana v11.0-preview
keywords:
  - grafana
  - breaking changes
  - documentation
  - '11.0'
  - '11.0-preview'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Breaking changes in Grafana v11.0-preview
weight: -3
---

# Breaking changes in Grafana v11.0-preview

Following are breaking changes that you should be aware of when upgrading to Grafana v11.0-preview.

For our purposes, a breaking change is any change that requires users or operators to do something. This includes:

- Changes in one part of the system that could cause other components to fail
- Deprecations or removal of a feature
- Changes to an API that could break automation
- Changes that affect some plugins or functions of Grafana
- Migrations that can’t be rolled back

For each change, the provided information:

- Helps you determine if you’re affected
- Describes the change or relevant background information
- Guides you in how to mitigate for the change or migrate
- Provides more learning resources

For release highlights and deprecations, refer to our [v11.0-preview What’s new](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/whats-new-in-v11-0/). For the specific steps we recommend when you upgrade to v10.3, check out our [Upgrade guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.0/).

<!--
## Feature

You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

<!-- Last copied from Google Doc March 18th -->

## Users and Operators

### AngularJS support is turned off by default

#### Description

In Grafana 11 support for the deprecated AngularJS framework will be turned off by default for all on-premise and Cloud instances of Grafana. This will prevent any data source or panel visualization which relies on AngularJS from being loaded, and therefore has the potential to significantly disrupt your dashboards. Support will be fully removed in the next major release of Grafana.

#### Migration/mitigation

To avoid disruption, ensure all plugins are up to date and migrate from any remaining AngularJS plugins to a React-based alternative. If a plugin relies on AngularJS, a warning icon and message will be displayed in the [plugins catalog](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/#plugin-catalog) in Grafana and any dashboard panel where it is used. Additionally, a warning banner will appear in any impacted dashboards. A list of all impacted dashboards can also be generated using the [`detect-angular-dashboards`](https://github.com/grafana/detect-angular-dashboards) tool.

Our [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/angular_deprecation/angular-plugins/) lists all known public plugins and provides migration advice when possible.

For on-premise users of Grafana and existing Grafana Cloud instances, support can be temporarily re-enabled through the [configuration parameter](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#angular_support_enabled) `angular_support_enabled=false`. New Grafana Cloud users will be unable to request for support to be added to their instance.

However, AngularJS based plugins will not receive any further updates and we strongly recommend migration as soon as possible. This configuration parameter will also be removed in the next major release after Grafana 11.

#### Learn more

Refer to this [blog post](TBA) for more information.

### Grafana Enterprise: Anonymous devices are billed as users

#### Description

Effective starting in Grafana 11.0, anonymous users will be counted and charged as users in Grafana Enterprise. When you upgrade to 11.0, anonymous users will be automatically counted as active users against your Grafana Enterprise license.

#### Migration/mitigation

Turn off anonymous access, and consider using public dashboards to allow view-only access to publicly-accessible dashboards.

#### Learn more

[Anonymous access documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/grafana/#anonymous-authentication)

### Legacy alerting has been entirely removed

Legacy alerting has reached its end-of-life. In Grafana 11 you can no longer enable legacy alerting, and Grafana will fail to start if the settings are not updated to run the new Grafana Alerting. This also means that starting in Grafana 11, it is no longer possible to migrate from legacy alerting to our new alerting. Grafana 10.4.x is the last version that offers migration, so make sure to migrate to the new Grafana Alerting system _before_ upgrading to Grafana 11. Learn more about Grafana Alerting and the advantages of the new system in the [legacy alerting deprecation documentation](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/legacy-alerting-deprecation/). Learn more about migration in the [upgrade alerting documentation](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/).

For more details on the code removal, review the following PRs:

- [https://github.com/grafana/grafana/pull/83651](https://github.com/grafana/grafana/pull/83651)
- [https://github.com/grafana/grafana/issues/81268](https://github.com/grafana/grafana/issues/81268)

#### Learn more

[https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/)

### Subfolders cause very rare issues with folders that have forward slashes in their names

#### Description and migration/mitigation

[Provisioning: Provision dashboards into subfolders](https://github.com/grafana/grafana/pull/79793)

[The alerting-related breaking change](https://raintank-corp.slack.com/archives/C045Y3PLNET/p1708629872856659?thread_ts=1707487168.475999&cid=C045Y3PLNET)

The upgrade to enable subfolders can cause some issues with alerts in certain cases. If you've previously set up a folder that uses a forward slash in its name, and you have an alert rule in that folder, and the notification policy is set to match that folder's name, notifications will be sent to the default receiver instead of the configured receiver.

In these cases, we recommend that you take these steps before the upgrade to enable subfolders:

- Create a copy of the affected routes and rewrite the matchers for the new copy. For example, if the original matcher was grafana_folder=MyFolder/sub-folder, then the new route matcher will be grafana_folder=MyFolder\/sub-folder.
- After enabling subfolders, you can delete the old routes.

Please note that if you use file provisioning, you can upgrade and update the routes at the same time.

#### Learn more

[https://grafana.com/docs/grafana-cloud/whats-new/#subfolders](https://grafana.com/docs/grafana-cloud/whats-new/#subfolders)

### The Input data source is removed

The direct input datasource plugin has been removed in Grafana 11. It has been in alpha for 4 years and is superseded by [TestData](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/) that ships with Grafana. This is a small deprecation.

Review this PR for details: [https://github.com/grafana/grafana/pull/83163](https://github.com/grafana/grafana/pull/83163)

### Chore: Query oauth info from a new instance

We're adding a validation between the response of the ID token HD parameter and the list of allowed domains as an extra layer of security. In the event that the HD parameter doesn't match the list of allowed domains, we're denying access to Grafana.

If you set Google OAuth configuration using `api_url,` you might be using the legacy implementation of OAuth, which doesn't have the HD parameter describing the organization the approved token comes from. This could break your login flow.

This feature can be turned off through the configuration toggle `validate_hd `. Anyone using the legacy Google OAuth configuration should turn off this validation if the ID Token response doesn't have the HD parameter.

[Github issue](https://github.com/grafana/grafana/pull/83229)

### Changes to how the panel view URL is generated for repeated panels

#### Description

With the introduction of the Scenes library to dashboards, the URL that’s generated when viewing an individual repeated panel has changed. We’ve changed how these panels are referenced and what used to be `&viewPanel=panel-5` is now `&viewPanel=panel-3-clone1`.

This means that the previous URLs won’t work anymore and instead you will be redirected to the dashboard view and get a _Panel not found_ error. From this point on, the dashboard will continue to work as expected.

#### Migration/mitigation

Just reopen the panel in view mode and you will get the new URL.

## Plugin developers

### React Router is deprecated

#### Description

In Grafana 11 we are marking react-router v5 as deprecated, app plugins should start migrating to use react-router v6.

#### Migration/mitigation

For a complete guide, please follow our [migration docs on the developer portal](https://grafana.com/developers/plugin-tools/migration-guides/update-from-grafana-versions/migrate-9_x-to-10_x#update-to-react-router-v6).

#### Learn more

- Grafana v9.x → v10.x [migration guide](https://grafana.com/developers/plugin-tools/migration-guides/update-from-grafana-versions/migrate-9_x-to-10_x#update-to-react-router-v6)
- Official react-router v5 to v6 [migration guide](https://reactrouter.com/en/main/upgrading/v5)
- Grafana community forum [topic](https://community.grafana.com/t/migrating-app-plugins-to-use-react-router-v6/115410)

### Chore: Taint ArrayVector with `never` to further discourage

[Github PR](https://github.com/grafana/grafana/pull/83681)

The Vector interface that was deprecated in Grafana 10 has been further deprecated. Using it will now generate build-time Typescript errors, but remain working at runtime. If you're still using ArrayVector in your code, it should be removed immediately and replaced with plain arrays. Plugins compiled against older versions and depend on calling get/set will continue to work because the Array prototype still has a modified prototype. This will be removed in the future

### Chore: Remove React 17 peer deps

[Github PR](https://github.com/grafana/grafana/pull/83524)

We've removed React 17 as a peer dependency from our packages. Anyone using the new versions of these packages should ensure they've upgraded to React 18 following the upgrade steps: [https://react.dev/blog/2022/03/08/react-18-upgrade-guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)

### Deprecated endpoints and fields in Reporting removed

#### Description

In G11, support for deprecated endpoints and fields in Reporting related to old scheduling format, email, and dashboard is fully removed . This will prevent any calls to deprecated endpoints and passing in values to deprecated fields. This feature will only affect Cloud and Enterprise customers.

#### Migration/mitigation

Ensure deprecated endpoints are updated to new corresponding endpoints and deprecated fields are removed and replaced with new corresponding fields.

#### Learn more

[Reporting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/reporting/) lists all supported endpoints and fields

### Change custom branding public dashboard footer behavior

#### Description

In G11, custom branding public dashboard footer behavior is changed to default to grafana logo if no footer logo or footer text is set. There is no option to hide the public dashboard footer anymore. This feature will only affect Advanced and Enterprise customers.

#### Migration/mitigation

Ensure customers have a public dashboard footer logo or footer text set if they do not want to display the default grafana footer.

#### Learn more

Configure custom branding [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/configure-custom-branding/#custom-branding-for-public-dashboards) for public dashboard
