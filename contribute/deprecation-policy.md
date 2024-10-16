# Deprecation policy

We do our best to limit breaking changes and the deprecation of features to major releases. We always do our best _not_ to introduce breaking changes in order to make upgrading Grafana as easy and reliable as possible. However, at times we have to introduce a breaking change by changing behavior or by removing a feature.

To minimize the negative effects of removing a feature, we require a deprecation plan. A typical deprecation plan includes these features:

- Determine usage levels of the feature.
- Find alternative solutions and possible migration paths.
- Announce deprecation of the feature.
- Migrate users if possible.
- Give users time to adjust to the deprecation.
- Disable the feature by default.
- Remove the feature from the code base.

We want the deprecation plan to be in the form of written communication for all parties so we know it's intentional and that a reasonable attempt was made to avoid breaking changes unnecessarily. Depending on the size and importance of the feature the plan can be a design doc or an issue.

> Grafana employees can find more details in our internal docs.

Additionally, the size of the feature requires different notice times between depreciation and disabling as well as disabling and removal. The actual duration will depend on releases of Grafana and the table below should be used as a guide.

## Grace period between announcement and disabling feature by default

| Size   | Duration   | Example                                                          |
| ------ | ---------- | ---------------------------------------------------------------- |
| Large  | 1-2 years  | Classic alerting, scripted dashboards, AngularJS                 |
| Medium | 6 months   | Supported database for Grafana's backend                         |
| Small  | 1-3 months | Refresh OAuth access_token automatically using the refresh_token |

## Announced deprecations

| Name                                                                     | Announcement Date | Disabling date | Removal Date | Description                                                                                                             | Status  |
| ------------------------------------------------------------------------ | ----------------- | -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| [Support for Mysql 5.7](https://github.com/grafana/grafana/issues/68446) | 2023-05-15        | October 2023   |              | MySQL 5.7 is being deprecated in October 2023 and Grafana's policy is to test against the officially supported version. | Planned |
