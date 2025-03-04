// eslint-disable-next-line lodash/import-scope
import _, { startsWith } from 'lodash';

import { ScopedVars } from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend, TemplateSrv, VariableInterpolation } from '@grafana/runtime';

import { resourceTypes } from '../azureMetadata';
import {
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData,
  AzureQueryType,
  AzureResourceGraphOptions,
  RawAzureResourceGroupItem,
  AzureGraphResponse,
  AzureMonitorDataSourceInstanceSettings,
  AzureGetResourceNamesQuery,
  RawAzureResourceItem,
} from '../types';
import { interpolateVariable, routeNames } from '../utils/common';

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

  private replaceTemplateVariables<T extends { [K in keyof T]: string }>(query: T, scopedVars?: ScopedVars) {
    const workingQueries: Array<{ [K in keyof T]: string }> = [{ ...query }];
    const keys = Object.keys(query) as Array<keyof T>;
    keys.forEach((key) => {
      const rawValue = workingQueries[0][key];
      let interpolated: VariableInterpolation[] = [];
      const replaced = this.templateSrv.replace(rawValue, scopedVars, 'raw', interpolated);
      if (interpolated.length > 0) {
        for (const variable of interpolated) {
          if (variable.found === false) {
            continue;
          }
          if (variable.value.includes(',')) {
            const multiple = variable.value.split(',');
            const currentQueries = [...workingQueries];
            multiple.forEach((value, i) => {
              currentQueries.forEach((q) => {
                if (i === 0) {
                  q[key] = rawValue.replace(variable.match, value);
                } else {
                  workingQueries.push({ ...q, [key]: rawValue.replace(variable.match, value) });
                }
              });
            });
          } else {
            workingQueries.forEach((q) => {
              q[key] = replaced;
            });
          }
        }
      } else {
        workingQueries.forEach((q) => {
          q[key] = replaced;
        });
      }
    });

    return workingQueries;
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

  async getResourceGroups(subscriptionId: string): Promise<Array<{ text: string; value: string }>> {
    const query = `resources 
    | where subscriptionId == '${subscriptionId}'
    | extend resourceGroupURI = strcat("/subscriptions/", subscriptionId, "/resourcegroups/", resourceGroup) 
    | join kind=leftouter (resourcecontainers  
        | where type =~ 'microsoft.resources/subscriptions/resourcegroups'  
        | project resourceGroupName=name, resourceGroupURI=tolower(id)) on resourceGroupURI 
    | project resourceGroupName=iff(resourceGroupName != "", resourceGroupName, resourceGroup), resourceGroupURI
    | summarize count() by resourceGroupName, resourceGroupURI
    | order by tolower(resourceGroupName) asc `;

    const resourceGroups = await this.pagedResourceGraphRequest<RawAzureResourceGroupItem>(query);

    return resourceGroups.map((r) => ({
      text: r.resourceGroupName,
      value: r.resourceGroupName,
    }));
  }

  async getResourceNames(query: AzureGetResourceNamesQuery) {
    const promises = this.replaceTemplateVariables(query).map(
      async ({ metricNamespace, subscriptionId, resourceGroup, region }) => {
        const validMetricNamespace = startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')
          ? 'microsoft.storage/storageaccounts'
          : metricNamespace;

        let prefix = `/subscriptions/${subscriptionId}`;
        if (resourceGroup) {
          prefix += `/resourceGroups/${resourceGroup}`;
        }

        const filters: string[] = [];
        if (validMetricNamespace) {
          filters.push(`type == '${validMetricNamespace}'`);
        }
        if (region) {
          filters.push(`location == '${region}'`);
        }

        const query = `resources
        | where id hasprefix "${prefix}"
        ${filters.length > 0 ? `| where ${filters.join(' and ')}` : ''}
        | order by tolower(name) asc`;

        const resources = await this.pagedResourceGraphRequest<RawAzureResourceItem>(query);

        return resources.map((r) => {
          if (startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')) {
            return {
              text: r.name + '/default',
              value: r.name + '/default',
            };
          }

          return {
            text: r.name,
            value: r.name,
          };
        });
      }
    );
    return (await Promise.all(promises)).flat();
  }

  // Retrieve metric namespaces relevant to a subscription/resource group/resource
  async getMetricNamespaces(resourceUri: string) {
    const promises = this.replaceTemplateVariables({ resourceUri }).map(async ({ resourceUri }) => {
      const namespacesFilter = resourceTypes.map((type) => `"${type}"`).join(',');
      const query = `
        resources
        | where id hasprefix "${resourceUri}"
        | where type in (${namespacesFilter})
        | project type
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
