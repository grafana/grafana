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
import { migrateStringQueriesToObjectQueries } from './grafanaTemplateVariableFns';
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
      const queryObj = await migrateStringQueriesToObjectQueries(request.targets[0], { datasource: this.datasource });

      if (queryObj.queryType === AzureQueryType.GrafanaTemplateVariableFn && queryObj.grafanaTemplateVariableFn) {
        try {
          const templateVariablesResults = await this.callGrafanaTemplateVariableFn(queryObj.grafanaTemplateVariableFn);
          return {
            data: templateVariablesResults?.length ? [toDataFrame(templateVariablesResults)] : [],
          };
        } catch (err) {
          return { data: [], error: { message: messageFromError(err) } };
        }
      }
      request.targets[0] = queryObj;
      return lastValueFrom(this.datasource.query(request));
    };

    return from(promisedResults());
  }

  callGrafanaTemplateVariableFn(query: GrafanaTemplateVariableQuery): Promise<MetricFindValue[]> | null {
    if (query.kind === 'SubscriptionsQuery') {
      return this.datasource.getSubscriptions();
    }

    if (query.kind === 'ResourceGroupsQuery') {
      return this.datasource.getResourceGroups(this.replaceVariable(query.subscription));
    }

    if (query.kind === 'MetricDefinitionsQuery') {
      return this.datasource.getMetricDefinitions(
        this.replaceVariable(query.subscription),
        this.replaceVariable(query.resourceGroup)
      );
    }

    if (query.kind === 'ResourceNamesQuery') {
      return this.datasource.getResourceNames(
        this.replaceVariable(query.subscription),
        this.replaceVariable(query.resourceGroup),
        this.replaceVariable(query.metricDefinition)
      );
    }

    if (query.kind === 'MetricNamespaceQuery') {
      return this.datasource.azureMonitorDatasource.getMetricNamespaces(query);
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
