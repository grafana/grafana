import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { CloudWatchAPI } from './api';
import { VariableQueryEditor } from './components/VariableQueryEditor/VariableQueryEditor';
import { CloudWatchDatasource } from './datasource';
import { migrateVariableQuery } from './migrations/variableQueryMigrations';
import { standardStatistics } from './standardStatistics';
import { VariableQuery, VariableQueryType } from './types';

export class CloudWatchVariableSupport extends CustomVariableSupport<CloudWatchDatasource, VariableQuery> {
  constructor(private readonly api: CloudWatchAPI) {
    super();
    this.query = this.query.bind(this);
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    const queryObj = migrateVariableQuery(request.targets[0]);
    return from(this.execute(queryObj)).pipe(map((data) => ({ data })));
  }

  async execute(query: VariableQuery) {
    try {
      switch (query.queryType) {
        case VariableQueryType.Regions:
          return this.handleRegionsQuery();
        case VariableQueryType.Namespaces:
          return this.handleNamespacesQuery();
        case VariableQueryType.Metrics:
          return this.handleMetricsQuery(query);
        case VariableQueryType.DimensionKeys:
          return this.handleDimensionKeysQuery(query);
        case VariableQueryType.DimensionValues:
          return this.handleDimensionValuesQuery(query);
        case VariableQueryType.EBSVolumeIDs:
          return this.handleEbsVolumeIdsQuery(query);
        case VariableQueryType.EC2InstanceAttributes:
          return this.handleEc2InstanceAttributeQuery(query);
        case VariableQueryType.ResourceArns:
          return this.handleResourceARNsQuery(query);
        case VariableQueryType.Statistics:
          return this.handleStatisticsQuery();
        case VariableQueryType.LogGroups:
          return this.handleLogGroupsQuery(query);
      }
    } catch (error) {
      console.error(`Could not run CloudWatchMetricFindQuery ${query}`, error);
      return [];
    }
  }

  async handleLogGroupsQuery({ region, logGroupPrefix }: VariableQuery) {
    const logGroups = await this.api.describeAllLogGroups({
      region,
      logGroupNamePrefix: logGroupPrefix,
    });
    return logGroups.map((s) => ({
      text: s.value,
      value: s.value,
      expandable: true,
    }));
  }

  async handleRegionsQuery() {
    const regions = await this.api.getRegions();
    return regions.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleNamespacesQuery() {
    const namespaces = await this.api.getNamespaces();
    return namespaces.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleMetricsQuery({ namespace, region }: VariableQuery) {
    const metrics = await this.api.getMetrics({ namespace, region });
    return metrics.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleDimensionKeysQuery({ namespace, region }: VariableQuery) {
    const keys = await this.api.getDimensionKeys({ namespace, region });
    return keys.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleDimensionValuesQuery({ namespace, region, dimensionKey, metricName, dimensionFilters }: VariableQuery) {
    if (!dimensionKey || !metricName) {
      return [];
    }
    const keys = await this.api.getDimensionValues({
      region,
      namespace,
      metricName,
      dimensionKey,
      dimensionFilters,
    });
    return keys.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleEbsVolumeIdsQuery({ region, instanceID }: VariableQuery) {
    if (!instanceID) {
      return [];
    }
    const ids = await this.api.getEbsVolumeIds(region, instanceID);
    return ids.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleEc2InstanceAttributeQuery({ region, attributeName, ec2Filters }: VariableQuery) {
    if (!attributeName) {
      return [];
    }
    const values = await this.api.getEc2InstanceAttribute(region, attributeName, ec2Filters ?? {});
    return values.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleResourceARNsQuery({ region, resourceType, tags }: VariableQuery) {
    if (!resourceType) {
      return [];
    }
    const keys = await this.api.getResourceARNs(region, resourceType, tags ?? {});
    return keys.map((s) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleStatisticsQuery() {
    return standardStatistics.map((s: string) => ({
      text: s,
      value: s,
      expandable: true,
    }));
  }
}
