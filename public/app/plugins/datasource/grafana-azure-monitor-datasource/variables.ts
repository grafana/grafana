import { from, lastValueFrom, Observable } from 'rxjs';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  toDataFrame,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import VariableEditor from './components/VariableEditor/VariableEditor';
import DataSource from './datasource';
import { migrateQuery } from './grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from './types';
import { GrafanaTemplateVariableQuery } from './types/templateVariables';
import messageFromError from './utils/messageFromError';

export class VariableSupport extends CustomVariableSupport<DataSource, AzureMonitorQuery> {
  constructor(private readonly datasource: DataSource) {
    super();
    this.datasource = datasource;
    this.query = this.query.bind(this);
  }

  editor = VariableEditor;

  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    const promisedResults = async () => {
      const queryObj = await migrateQuery(request.targets[0], { datasource: this.datasource });

      try {
        switch (queryObj.queryType) {
          case AzureQueryType.SubscriptionsQuery:
            const res = await this.datasource.getSubscriptions();
            return {
              data: res?.length ? [toDataFrame(res)] : [],
            };
          case AzureQueryType.ResourceGroupsQuery:
            if (queryObj.subscription) {
              const rgs = await this.datasource.getResourceGroups(queryObj.subscription);
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
          case AzureQueryType.NamespacesQuery:
            if (queryObj.subscription) {
              const rgs = await this.datasource.getMetricNamespaces(queryObj.subscription, queryObj.resourceGroup);
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
          case AzureQueryType.ResourceNamesQuery:
            if (queryObj.subscription) {
              const rgs = await this.datasource.getResourceNames(
                queryObj.subscription,
                queryObj.resourceGroup,
                queryObj.namespace
              );
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
          case AzureQueryType.MetricNamesQuery:
            if (queryObj.subscription && queryObj.resourceGroup && queryObj.namespace && queryObj.resource) {
              const rgs = await this.datasource.getMetricNames(
                queryObj.subscription,
                queryObj.resourceGroup,
                queryObj.namespace,
                queryObj.resource
              );
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
          case AzureQueryType.WorkspacesQuery:
            if (queryObj.subscription) {
              const rgs = await this.datasource.getAzureLogAnalyticsWorkspaces(queryObj.subscription);
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
          case AzureQueryType.GrafanaTemplateVariableFn:
            if (queryObj.grafanaTemplateVariableFn) {
              const templateVariablesResults = await this.callGrafanaTemplateVariableFn(
                queryObj.grafanaTemplateVariableFn
              );
              return {
                data: templateVariablesResults?.length ? [toDataFrame(templateVariablesResults)] : [],
              };
            }
          default:
            request.targets[0] = queryObj;
            const queryResp = await lastValueFrom(this.datasource.query(request));
            return {
              data: queryResp.data,
              error: queryResp.error ? new Error(messageFromError(queryResp.error)) : undefined,
            };
        }
      } catch (err) {
        return { data: [], error: new Error(messageFromError(err)) };
      }
    };

    return from(promisedResults());
  }

  // Deprecated
  callGrafanaTemplateVariableFn(query: GrafanaTemplateVariableQuery): Promise<MetricFindValue[]> | null {
    if (query.kind === 'SubscriptionsQuery') {
      return this.datasource.getSubscriptions();
    }

    if (query.kind === 'ResourceGroupsQuery') {
      return this.datasource.getResourceGroups(this.replaceVariable(query.subscription));
    }

    if (query.kind === 'ResourceNamesQuery') {
      return this.datasource.getResourceNames(
        this.replaceVariable(query.subscription),
        this.replaceVariable(query.resourceGroup),
        this.replaceVariable(query.metricNamespace)
      );
    }

    if (query.kind === 'MetricNamespaceQuery') {
      return this.datasource.azureMonitorDatasource.getMetricNamespaces(query, true);
    }

    if (query.kind === 'MetricNamesQuery') {
      return this.datasource.azureMonitorDatasource.getMetricNames(query);
    }

    if (query.kind === 'WorkspacesQuery') {
      return this.datasource.azureLogAnalyticsDatasource.getWorkspaces(this.replaceVariable(query.subscription));
    }

    return null;
  }

  replaceVariable(metric: string) {
    return getTemplateSrv().replace((metric || '').trim());
  }
}
