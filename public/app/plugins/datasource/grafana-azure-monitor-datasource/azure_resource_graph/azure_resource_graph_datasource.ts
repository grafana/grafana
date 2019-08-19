import _ from 'lodash';
import { AzureDataSourceJsonData } from '../types';
import { DataSourceInstanceSettings } from '@grafana/ui';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { IQService } from 'angular';

export default class AzureResourceGraphDatasource {
  id: number;
  url: string;
  cloudName: string;
  baseUrl: string;
  /** @ngInject */
  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv,
    private $q: IQService
  ) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.cloudName = instanceSettings.jsonData.cloudName || 'azuremonitor';
    this.baseUrl = `/resourcegraph`;
  }

  getSubscriptions(route?: string) {
    const url = `/${route || this.cloudName}/subscriptions?api-version=2019-03-01`;
    return this.doSubscriptionsRequest(url).then((result: any) => {
      if (result && result.data && result.data.value) {
        return result.data.value.map((sub: any) => sub.subscriptionId);
      } else {
        return [];
      }
    });
  }

  doSubscriptionsRequest(url: string, maxRetries = 1) {
    return this.backendSrv
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.doRequest(url, maxRetries - 1);
        }
        throw error;
      });
  }

  async doRequest(query: any, maxRetries = 1) {
    const subscriptions = await this.getSubscriptions();
    return this.backendSrv
      .datasourceRequest({
        url: query.url + '?api-version=2019-04-01',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          query: query.query,
          subscriptions,
          options: {
            $top: query.top,
            $skip: query.skip,
            resultFormat: 'table',
          },
        },
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.doRequest(query, maxRetries - 1);
        }
        throw error;
      });
  }

  doQueries(queries: any) {
    return _.map(queries, query => {
      return this.doRequest(query)
        .then((result: any) => {
          return {
            result: result,
            query: query,
          };
        })
        .catch((err: any) => {
          throw {
            error: err,
            query: query,
          };
        });
    });
  }

  async query(options: any) {
    const queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(target => {
      const item = target.azureResourceGraph;
      return {
        url: this.url + this.baseUrl,
        refId: target.refId,
        intervalMs: options.intervalMs,
        datasourceId: this.id,
        queryType: 'Azure Resource Graph',
        resultFormat: 'table',
        query: this.templateSrv.replace(item.query, options.scopedVars),
        top: item.top,
        skip: item.skip,
      };
    });
    if (!queries || queries.length === 0) {
      return;
    }
    const promises = this.doQueries(queries);
    return this.$q.all(promises).then(results => {
      if (results && results[0] && results[0].result && results[0].result.data && results[0].result.data.data) {
        const output = results[0].result.data.data;
        output.type = 'table';
        output.columns = output.columns.map((c: any, index: number) => {
          c.text = c.name || index;
          c.type = c.type || 'string';
          return c;
        });
        output.rows = output.rows.map((r: any) => {
          return r.map((ri: any) => {
            if (typeof ri === 'string') {
              return ri;
            } else {
              return JSON.stringify(ri);
            }
          });
        });
        return output;
      } else {
        return [];
      }
    });
  }
}
