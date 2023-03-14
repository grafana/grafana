import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { IframeController } from './sandboxIframeController';

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
    // console.log(options);
    // Return a constant for each query.
    const data = options.targets.map((target) => {
      // gen 2 random numbers from 1 to 100
      const random1 = Math.floor(Math.random() * 100) + 1;
      const random2 = Math.floor(Math.random() * 100) + 1;
      return new MutableDataFrame({
        refId: target.refId,
        fields: [{ name: 'Static Sandbox Datasource', values: [random1, random2], type: FieldType.number }],
      });
    });

    return { data };
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
