import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
} from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { IframeController } from './sandboxIframeController';
import { fromDataQueryRequestToSandboxDataQueryRequest } from './sandboxSerializer';
import { SandboxMessageType } from './types';

export interface SandboxQuery extends DataQuery {}
export interface SandboxOptions extends DataSourceJsonData {}

export class SandboxProxyDataSource extends DataSourceApi<SandboxQuery, SandboxOptions> {
  instanceSettings: DataSourceInstanceSettings;
  iframeController: IframeController;

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    // this is normal info
    this.instanceSettings = instanceSettings;
    this.iframeController = new IframeController({
      pluginMeta: instanceSettings.meta,
      instanceSettings,
    });
    this.iframeController.setupSandbox();
  }

  async query(options: DataQueryRequest<SandboxQuery>): Promise<DataQueryResponse> {
    return this.iframeController.sendMessage({
      type: SandboxMessageType.DatasourceQuery,
      options: fromDataQueryRequestToSandboxDataQueryRequest(options),
    });
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}

export const sandboxDatasourcePlugin = new DataSourcePlugin<SandboxProxyDataSource, SandboxQuery, SandboxOptions>(
  SandboxProxyDataSource
);
