---
description: Breaking changes for Grafana v13.0
keywords:
  - grafana
  - breaking changes
  - documentation
  - '13.0'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Breaking changes in Grafana v13.0
weight: -5
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# Breaking changes in Grafana v13.0

Following are breaking changes that you should be aware of when upgrading to Grafana v13.0.

For our purposes, a breaking change is any change that requires users or operators to do something. This includes:

- Changes in one part of the system that could cause other components to fail
- Deprecations or removal of a feature
- Changes to an API that could break automation
- Changes that affect some plugins or functions of Grafana
- Migrations that can't be rolled back

For each change, the provided information:

- Helps you determine if you're affected
- Describes the change or relevant background information
- Guides you in how to mitigate for the change or migrate
- Provides more learning resources

For release highlights and deprecations, refer to our [v13.0 What's new](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/whats-new-in-v13-0/). For the specific steps we recommend when you upgrade to v13.0, check out our [Upgrade guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v13.0/).

## Alerting

### Legacy Alertmanager configuration API endpoints changed

#### You are affected if

You use any of the following endpoints directly, for example in automation scripts or custom tooling:

- `DELETE /api/alertmanager/grafana/config/api/v1/alerts`
- `GET /api/alertmanager/grafana/config/api/v1/alerts`
- `GET /api/alertmanager/grafana/config/history`
- `POST /api/alertmanager/grafana/config/history/{id}/_activate`
- `POST /api/alertmanager/grafana/config/api/v1/receivers/test`

#### Description

These endpoints were deprecated in Grafana v12 and rely on legacy single-tenant Alertmanager configuration semantics.

- `DELETE /api/alertmanager/grafana/config/api/v1/alerts` has been removed entirely.
- `POST /api/alertmanager/grafana/config/api/v1/receivers/test` has been removed entirely.
- `GET /api/alertmanager/grafana/config/api/v1/alerts` is now restricted to admin users. A `Warning: 299` response header is included to help identify any remaining automated consumers. The endpoint will be fully removed in Grafana v14.
- `GET /api/alertmanager/grafana/config/history` is now restricted to admin users. The endpoint will be fully removed in Grafana v14.
- `POST /api/alertmanager/grafana/config/history/{id}/_activate` is now restricted to admin users. The endpoint will be fully removed in Grafana v14.

#### Migration

Use the Kubernetes-style resource APIs under `notifications.alerting.grafana.app/v1beta1`:

| Resource              | API path                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Receivers             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`            |
| Notification policies | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`         |
| Templates             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`       |
| Mute timings          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`        |
| Inhibition rules      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`      |
| Receiver testing      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{uid}/test` |

### Alertmanager status endpoint requires a new permission

#### You are affected if

You use the `GET /api/alertmanager/grafana/api/v2/status` endpoint and rely on the `alert.notifications:read` permission to access it.

#### Description

The `GET /api/alertmanager/grafana/api/v2/status` endpoint previously required the legacy `alert.notifications:read` permission. It now requires a dedicated `alert.notifications.system-status:read` permission. This new permission is included in the `fixed:alerting.notifications:writer` role, which is granted to Admin users by default.

#### Migration

If you have custom roles that need access to this endpoint, add the `alert.notifications.system-status:read` action to those roles. Admin users are unaffected as they receive this permission automatically through the built-in alerting notifications writer role.
