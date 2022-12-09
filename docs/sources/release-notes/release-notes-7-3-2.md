---
_build:
  list: false
title: Release notes for Grafana 7.3.2
---

<!-- Auto generated do not edit -->

# Release notes for Grafana 7.3.2

### Features and enhancements

- **CloudWatch Logs**: Change how we measure query progress. [#28912](https://github.com/grafana/grafana/pull/28912), [@aocenas](https://github.com/aocenas)
- **Dashboards / Folders**: delete related data (permissions, stars, tags, versions, annotations) when deleting a dashboard or a folder. [#28826](https://github.com/grafana/grafana/pull/28826), [@AgnesToulet](https://github.com/AgnesToulet)
- **Gauge**: Improve font size auto sizing. [#28797](https://github.com/grafana/grafana/pull/28797), [@torkelo](https://github.com/torkelo)
- **Short URL**: Cleanup unvisited/stale short URLs. [#28867](https://github.com/grafana/grafana/pull/28867), [@wbrowne](https://github.com/wbrowne)
- **Templating**: Custom variable edit UI, change options input into textarea. [#28322](https://github.com/grafana/grafana/pull/28322), [@darrylsepeda](https://github.com/darrylsepeda)

### Bug fixes

- **Cloudwatch**: Fix issue with field calculation transform not working properly with Cloudwatch data. [#28761](https://github.com/grafana/grafana/pull/28761), [@torkelo](https://github.com/torkelo)
- **Dashboard**: fix view panel mode for Safari / iOS. [#28702](https://github.com/grafana/grafana/pull/28702), [@jackw](https://github.com/jackw)
- **Elasticsearch**: Exclude pipeline aggregations from order by options. [#28620](https://github.com/grafana/grafana/pull/28620), [@simianhacker](https://github.com/simianhacker)
- **Panel inspect**: Interpolate variables in panel inspect title. [#28779](https://github.com/grafana/grafana/pull/28779), [@dprokop](https://github.com/dprokop)
- **Prometheus**: Fix copy paste behaving as cut and paste. [#28622](https://github.com/grafana/grafana/pull/28622), [@aocenas](https://github.com/aocenas)
- **StatPanels**: Fixes auto min max when latest value is zero. [#28982](https://github.com/grafana/grafana/pull/28982), [@torkelo](https://github.com/torkelo)
- **TableFilters**: Fixes filtering with field overrides. [#28690](https://github.com/grafana/grafana/pull/28690), [@hugohaggmark](https://github.com/hugohaggmark)
- **Templating**: Speeds up certain variable queries for Postgres MySql MSSql. [#28686](https://github.com/grafana/grafana/pull/28686), [@hugohaggmark](https://github.com/hugohaggmark)
- **Units**: added support to handle negative fractional numbers. [#28849](https://github.com/grafana/grafana/pull/28849), [@mckn](https://github.com/mckn)
- **Variables**: Fix backward compatibility in custom variable options that contain colon. [#28896](https://github.com/grafana/grafana/pull/28896), [@mckn](https://github.com/mckn)
