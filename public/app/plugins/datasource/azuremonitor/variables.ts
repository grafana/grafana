import { startsWith } from 'lodash';
import { from, lastValueFrom, Observable } from 'rxjs';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  toDataFrame,
} from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import UrlBuilder from './azure_monitor/url_builder';
import { parseResourceURI } from './components/ResourcePicker/utils';
import VariableEditor from './components/VariableEditor/VariableEditor';
import DataSource from './datasource';
import { migrateQuery } from './grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from './types/query';
import { GrafanaTemplateVariableQuery } from './types/templateVariables';
import { RawAzureResourceItem } from './types/types';
import messageFromError from './utils/messageFromError';

export function parseResourceNamesAsTemplateVariable(resources: RawAzureResourceItem[], metricNamespace?: string) {
  return resources.map((r) => {
    if (startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')) {
      return {
        text: r.name + '/default',
        value: r.name + '/default',
      };
    }

    return {
      text: r.name,
      value: parseResourceURI(r.id).resourceName,
    };
  });
}

export class VariableSupport extends CustomVariableSupport<DataSource, AzureMonitorQuery> {
  constructor(
    private readonly datasource: DataSource,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super();
    this.datasource = datasource;
  }

  editor = VariableEditor;

  hasValue(...values: string[]) {
    return values.every((v) => !!this.templateSrv.replace(v));
  }

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
            if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
              const rgs = await this.datasource.getResourceGroups(queryObj.subscription);
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.NamespacesQuery:
            if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
              const namespaces = await this.datasource.getMetricNamespaces(
                queryObj.subscription,
                queryObj.resourceGroup,
                undefined,
                false,
                true
              );
              return {
                data: namespaces?.length ? [toDataFrame(namespaces)] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.ResourceNamesQuery:
            if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
              const resources = await this.datasource.getResourceNames(
                queryObj.subscription,
                queryObj.resourceGroup,
                queryObj.namespace,
                queryObj.region
              );
              return {
                data: resources?.length ? [toDataFrame(parseResourceNamesAsTemplateVariable(resources))] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.MetricNamesQuery:
            if (
              queryObj.subscription &&
              queryObj.resourceGroup &&
              queryObj.namespace &&
              queryObj.resource &&
              this.hasValue(queryObj.subscription, queryObj.resourceGroup, queryObj.namespace, queryObj.resource)
            ) {
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
            return { data: [] };
          case AzureQueryType.WorkspacesQuery:
            if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
              const rgs = await this.datasource.getAzureLogAnalyticsWorkspaces(queryObj.subscription);
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.GrafanaTemplateVariableFn:
            if (queryObj.grafanaTemplateVariableFn) {
              const templateVariablesResults = await this.callGrafanaTemplateVariableFn(
                queryObj.grafanaTemplateVariableFn
              );
              return {
                data: templateVariablesResults?.length ? [toDataFrame(templateVariablesResults)] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.LocationsQuery:
            if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
              const locationMap = await this.datasource.azureMonitorDatasource.getLocations([queryObj.subscription]);
              const res: Array<{ text: string; value: string }> = [];
              locationMap.forEach((loc) => {
                res.push({ text: loc.displayName, value: loc.name });
              });
              return {
                data: res?.length ? [toDataFrame(res)] : [],
              };
            }
          case AzureQueryType.CustomNamespacesQuery:
            if (
              queryObj.subscription &&
              queryObj.resourceGroup &&
              queryObj.namespace &&
              queryObj.resource &&
              this.hasValue(queryObj.subscription, queryObj.resourceGroup, queryObj.namespace, queryObj.resource)
            ) {
              const resourceUri = UrlBuilder.buildResourceUri(this.templateSrv, {
                subscription: queryObj.subscription,
                resourceGroup: queryObj.resourceGroup,
                metricNamespace: queryObj.namespace,
                resourceName: queryObj.resource,
              });
              const res = await this.datasource.getMetricNamespaces(
                queryObj.subscription,
                queryObj.resourceGroup,
                resourceUri,
                true
              );
              return {
                data: res?.length ? [toDataFrame(res)] : [],
              };
            }
            return { data: [] };
          case AzureQueryType.CustomMetricNamesQuery:
            if (
              queryObj.subscription &&
              queryObj.resourceGroup &&
              queryObj.namespace &&
              queryObj.resource &&
              queryObj.customNamespace &&
              this.hasValue(
                queryObj.subscription,
                queryObj.resourceGroup,
                queryObj.namespace,
                queryObj.resource,
                queryObj.customNamespace
              )
            ) {
              const rgs = await this.datasource.getMetricNames(
                queryObj.subscription,
                queryObj.resourceGroup,
                queryObj.namespace,
                queryObj.resource,
                queryObj.customNamespace
              );
              return {
                data: rgs?.length ? [toDataFrame(rgs)] : [],
              };
            }
            return { data: [] };
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
      return this.datasource.getResourceGroups(this.replaceVariable(query.subscription)).then((rgs) => {
        if (rgs.length > 0) {
          return rgs.map((rg) => ({ text: rg.resourceGroupName, value: rg.resourceGroupName }));
        }

        return [];
      });
    }

    if (query.kind === 'ResourceNamesQuery') {
      return this.datasource
        .getResourceNames(
          this.replaceVariable(query.subscription),
          this.replaceVariable(query.resourceGroup),
          this.replaceVariable(query.metricNamespace)
        )
        .then((resources) => {
          if (resources.length > 0) {
            return parseResourceNamesAsTemplateVariable(resources, query.metricNamespace);
          }
          return [];
        });
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
    return this.templateSrv.replace((metric || '').trim());
  }
}
