// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';

import { ScopedVars } from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend, TemplateSrv } from '@grafana/runtime';

import { resourceTypes } from '../azureMetadata';
import {
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData,
  AzureQueryType,
  AzureMonitorDataSourceInstanceSettings,
  RawAzureResourceItem,
  AzureGraphResponse,
  AzureResourceGraphOptions,
} from '../types';
import { interpolateVariable, replaceTemplateVariables, routeNames } from '../utils/common';

export default class AzureResourceGraphDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  resourcePath: string;
  resourceGraphURL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';
  constructor(
    instanceSettings: AzureMonitorDataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.resourcePath = routeNames.resourceGraph;
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return !!item.azureResourceGraph?.query && !!item.subscriptions && item.subscriptions.length > 0;
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const ts = getTemplateSrv();
    const item = target.azureResourceGraph;
    if (!item) {
      return target;
    }
    const variableNames = ts.getVariables().map((v) => `$${v.name}`);
    const subscriptionVar = _.find(target.subscriptions, (sub) => _.includes(variableNames, sub));
    const interpolatedSubscriptions = ts
      .replace(subscriptionVar, scopedVars, (v: string[] | string) => v)
      .split(',')
      .filter((v) => v.length > 0);
    const subscriptions = [
      ...interpolatedSubscriptions,
      ..._.filter(target.subscriptions, (sub) => !_.includes(variableNames, sub)),
    ];
    const query = ts.replace(item.query, scopedVars, interpolateVariable);

    return {
      ...target,
      queryType: AzureQueryType.AzureResourceGraph,
      subscriptions,
      azureResourceGraph: {
        resultFormat: 'table',
        query,
      },
    };
  }

  async pagedResourceGraphRequest<T = unknown>(query: string, maxRetries = 1): Promise<T[]> {
    try {
      let allFetched = false;
      let $skipToken = undefined;
      let response: T[] = [];
      while (!allFetched) {
        // The response may include several pages
        let options: Partial<AzureResourceGraphOptions> = {};
        if ($skipToken) {
          options = {
            $skipToken,
          };
        }
        const queryResponse = await this.postResource<AzureGraphResponse<T[]>>(
          this.resourcePath + this.resourceGraphURL,
          {
            query: query,
            options: {
              resultFormat: 'objectArray',
              ...options,
            },
          }
        );
        response = response.concat(queryResponse.data);
        $skipToken = queryResponse.$skipToken;
        allFetched = !$skipToken;
      }

      return response;
    } catch (error) {
      if (maxRetries > 0) {
        return this.pagedResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }

  // Retrieve metric namespaces relevant to a subscription/resource group/resource
  async getMetricNamespaces(resourceUri: string) {
    const promises = replaceTemplateVariables(this.templateSrv, { resourceUri }).map(async ({ resourceUri }) => {
      const namespacesFilter = resourceTypes.map((type) => `"${type}"`).join(',');
      const query = `
        resources
        | where id hasprefix "${resourceUri}"
        | where type in (${namespacesFilter})
        | project type
        | distinct type
        | order by tolower(type) asc`;

      const namespaces = await this.pagedResourceGraphRequest<RawAzureResourceItem>(query);

      return namespaces.map((r) => {
        return {
          text: r.type,
          value: r.type,
        };
      });
    });
    return (await Promise.all(promises)).flat();
  }
}
