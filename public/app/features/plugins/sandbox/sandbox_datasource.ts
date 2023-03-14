import { v4 as uuidv4 } from 'uuid';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { SandboxGrafanaBootData, SandboxMessageType } from './types';

export interface SandboxQuery extends DataQuery {}
export interface SandboxOptions extends DataSourceJsonData {}

export class SandboxProxyDataSource extends DataSourceApi<SandboxQuery, SandboxOptions> {
  isSandbox = true;
  instanceSettings: DataSourceInstanceSettings;
  private channel: MessageChannel;
  private iframe: HTMLIFrameElement;
  private isHandShakeDone = false;
  // private isReady = false;
  private key: string;

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    // this is normal info
    this.instanceSettings = instanceSettings;
    this.iframe = document.createElement('iframe');
    this.setupSandbox(this.iframe, instanceSettings);
    this.channel = new MessageChannel();
    this.onIframeMessage = this.onIframeMessage.bind(this);
    this.key = uuidv4();
  }

  setupSandbox(iframe: HTMLIFrameElement, instanceSettings: DataSourceInstanceSettings) {
    const srcDoc = this.getSrcDoc(instanceSettings, config);

    iframe.className = 'sandbox-iframe';
    iframe.srcdoc = srcDoc;
    iframe.style.display = 'none';
    iframe.id = 'sandbox-iframe-' + instanceSettings.uid;

    iframe.addEventListener('load', () => {
      this.channel.port1.onmessage = this.onIframeMessage;
      iframe.contentWindow?.postMessage(
        {
          type: SandboxMessageType.Init,
          id: instanceSettings.uid,
        },
        // '*',
        window.location.origin,
        [this.channel.port2]
      );
    });

    // run the iframe
    window.document.body.appendChild(iframe);
  }

  onIframeMessage = (event: MessageEvent) => {
    console.log('onIframeMessage', event);

    // do not process any messages before handshake
    if (!this.isHandShakeDone && event.data.type !== SandboxMessageType.Handshake) {
      return;
    }

    if (
      !this.isHandShakeDone &&
      event.data.type === SandboxMessageType.Handshake &&
      event.data.uid === this.instanceSettings.uid
    ) {
      this.isHandShakeDone = true;
      this.channel.port1.postMessage({
        type: SandboxMessageType.Handshake,
        key: this.key,
      });
      return;
    }
  };

  getSrcDoc(instanceSettings: DataSourceInstanceSettings, bootConfig: GrafanaBootConfig) {
    const sandboxBootData: SandboxGrafanaBootData = {
      instanceSettings,
      isSandbox: true,
      isDev: bootConfig.buildInfo.env === 'development',
      modulePath: bootConfig.appSubUrl + '/public/' + instanceSettings.meta.module + '.js',
    };
    const srcDoc = `
      <html>
        <head>
          <script>
            window.grafanaSandboxData = ${JSON.stringify(sandboxBootData)};
          </script>
          <script src="${bootConfig.appSubUrl}/public/build/runtime~sandboxRuntime.js"></script>
          <script src="${bootConfig.appSubUrl}/public/build/sandboxRuntime.js"></script>
        </head>
        <body>
      </html>
      `;
    return srcDoc;
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
