import React, { useEffect, useRef } from 'react';

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
import { SandboxDatasourceQueryEditorProps, SandboxMessageType } from './types';

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

  //@ts-ignore -- this is a hack to get the components to load
  get components() {
    const iframeController = this.iframeController;
    return {
      QueryEditor: (props: SandboxDatasourceQueryEditorProps) => {
        const ref = useRef<HTMLDivElement>(null);

        useEffect(() => {
          if (ref.current) {
            iframeController.mountQueryEditor(ref.current, props);
          }
        }, [props]);
        return <div style={{ height: '500px' }} ref={ref}></div>;
      },
    };
  }

  //@ts-ignore -- this is a hack to get the components to load
  set components(_: any) {
    // don't overwrite
  }

  async query(options: DataQueryRequest<SandboxQuery>): Promise<DataQueryResponse> {
    const response = await this.iframeController.sendRequest({
      type: SandboxMessageType.DatasourceQuery,
      options: fromDataQueryRequestToSandboxDataQueryRequest(options),
    });
    if (response.type === SandboxMessageType.DatasourceQueryResponse) {
      return response.payload;
    }
    throw new Error('unknown response');
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
