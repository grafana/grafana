import _ from 'lodash';
import { AzureDataSourceJsonData, AzureResourceGraphQuery, AzureResourceGraphQueryOptions } from '../types';
import { DataSourceInstanceSettings } from '@grafana/ui';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { IQService } from 'angular';

export class AzureResourceGraphResponseParser {
  output: any = {};

  constructor(results: any[]) {
    this.output = {
      type: 'table',
      columns: [],
      rows: [],
    };
    if (results && results[0] && results[0].result && results[0].result.data && results[0].result.data.data) {
      const output = results[0].result.data.data || {};
      this.output.columns = (output.columns || []).map((column: any, index: number) => {
        column.text = column.name || index;
        column.type = column.type || 'string';
        return column;
      });
      this.output.rows = (output.rows || []).map((row: any) => {
        return row.map((rowItem: any) => {
          if (typeof rowItem === 'string') {
            return rowItem;
          } else {
            return JSON.stringify(rowItem);
          }
        });
      });
    }
  }

  getResultsAsVariablesList() {
    const returnvalues: any[] = [];
    _.each(this.output.rows, row => {
      _.each(row, col => {
        returnvalues.push({
          value: col,
          text: col,
        });
      });
    });
    return returnvalues;
  }
}

export class AzureResourceGraphQueryOption implements AzureResourceGraphQueryOptions {
  url: string;
  query: string;
  top: number;
  skip: number;

  constructor(url: string, query: string, top: number, skip: number) {
    this.url = url;
    this.query = query;
    this.top = top;
    this.skip = skip;
  }
}

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

  getupSubscriptionIds() {
    const url = `/${this.cloudName}/subscriptions?api-version=2019-03-01`;
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
          return this.doSubscriptionsRequest(url, maxRetries - 1);
        }
        throw error;
      });
  }

  async doResourceGraphRequest(query: AzureResourceGraphQueryOption, maxRetries = 1) {
    const subscriptions = await this.getupSubscriptionIds();
    return this.backendSrv
      .datasourceRequest({
        url: query.url + '?api-version=2019-04-01',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          query: query.query,
          subscriptions,
          options: {
            $top: query.top || 100,
            $skip: query.skip || 0,
            resultFormat: 'table',
          },
        },
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.doResourceGraphRequest(query, maxRetries - 1);
        }
        throw error;
      });
  }

  doQueries(queries: AzureResourceGraphQueryOption[]) {
    return _.map(queries, query => {
      return this.doResourceGraphRequest(query)
        .then((result: any) => {
          return { result, query };
        })
        .catch((error: any) => {
          throw { error, query };
        });
    });
  }

  async query(options: any) {
    const queries: AzureResourceGraphQueryOption[] = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(target => {
      const item: AzureResourceGraphQuery = target.azureResourceGraph;
      const queryOption = new AzureResourceGraphQueryOption(
        this.url + this.baseUrl,
        this.templateSrv.replace(item.query, options.scopedVars),
        item.top,
        item.skip
      );
      return queryOption;
    });
    if (!queries || queries.length === 0) {
      return;
    }
    const promises = this.doQueries(queries);
    return this.$q.all(promises).then(results => {
      const responseParser = new AzureResourceGraphResponseParser(results);
      return responseParser.output;
    });
  }

  metricFindQuery(query: string) {
    if (query.startsWith(`ResourceGraph(`) && query.endsWith(`)`)) {
      const resourceGraphQuery = query.replace(`ResourceGraph(`, ``).slice(0, -1);
      const queryOption = new AzureResourceGraphQueryOption(
        this.url + this.baseUrl,
        this.templateSrv.replace(resourceGraphQuery),
        1000,
        0
      );
      const promises = this.doQueries([queryOption]);
      return this.$q.all(promises).then(results => {
        const responseParser = new AzureResourceGraphResponseParser(results);
        return responseParser.getResultsAsVariablesList();
      });
    }
    return undefined;
  }
}
