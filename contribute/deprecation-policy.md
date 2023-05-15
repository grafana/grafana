# Deprecation policy

Prior to Grafana 10, major releases were an opportunity to make breaking changes and remove code we didn’t want to maintain.

Going forward that is something we will avoid in order to make it easier to upgrade Grafana. From now on we should avoid making unexpected breaking changes to the customer experience and our ability to operate our service.

If we cannot remove the features without introducing a breaking chance we should follow an deprecation plan as listed below.

- A deprecation plan should have the following steps.
- Figure out usage stats for the feature.
- Find alternative solutions and possible migration paths.
- Announce deprecation of the feature.
- Migrate users if possible
- Give users time to adjust to the deprecation.
- Disable the feature by default.
- Remove the feature from the code base.

Depending on the size and importance of the feature this can be a design doc or an issue. We want this to be written communication for all parts so we know it's intentional and that did a reasonable attempt to avoid breaking changes unless needed. The size of the feature also means different notice times between Depreciation and disabling as well as disabling and removal. The actual duration will depend on releases of Grafana and this should be seen as guidelines.

## Duration

| Size   | Duration   | Example                                                          |
| ------ | ---------- | ---------------------------------------------------------------- |
| Large  | 1-2 years  | Classic alerting, scripted dashboards, AngularJS                 |
| Medium | 6 months   | Supported Database for Grafana's backend                         |
| Small  | 1-3 months | Refresh OAuth access_token automatically using the refresh_token |

## Announced deprecations.

| Name                  | Annoucement Date | Disabling date | Removal Date | Description                                                                                                               | Status  |
| --------------------- | ---------------- | -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- | ------- |
| Support for Mysql 5.7 | 2023-05-15       | October 2023   |              | MySQL 5.7 is getting deprecated in October 2023 and Grafana's policy is to test against the officially supported version. | Planned |
