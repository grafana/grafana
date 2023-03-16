import React from 'react';
import ReactDOM from 'react-dom';

import { DataFrame, dataFrameToJSON, DataQueryResponse, DataSourceApi, GrafanaPlugin } from '@grafana/data';

import { IFrameBus } from '../iframeBus/iframeBus';
import { fromSandboxDataQueryRequestToDataQueryRequest } from '../sandboxSerializer';
import {
  SandboxDatasourceQueryMessage,
  SandboxDatasourceQueryResponse,
  SandboxGrafanaBootData,
  SandboxGrafanaRunTime,
  SandboxMessage,
  SandboxMessageType,
} from '../types';

import { GrafanaRuntimeProxy } from './grafanaRuntimeProxy';

export class SandboxRuntime {
  private port: MessagePort;
  private bootData: SandboxGrafanaBootData;
  private isHandShakeDone = false;
  private isReady = false;
  private plugin?: GrafanaPlugin;
  private datasourceInstance?: DataSourceApi;
  private iframeBus: IFrameBus<SandboxMessage>;
  private grafanaRunTime: SandboxGrafanaRunTime = {};
  private appRoot: HTMLElement;

  constructor({ port, bootData }: { port: MessagePort; bootData: SandboxGrafanaBootData }) {
    this.port = port;
    this.bootData = bootData;
    this.iframeBus = new IFrameBus<SandboxMessage>({
      port: this.port,
      onMessage: this.handleMessage.bind(this),
    });
    this.mockGrafanaRuntime();
    this.appRoot = document.getElementById('app') || document.body;
  }

  mockGrafanaRuntime() {
    this.grafanaRunTime = new GrafanaRuntimeProxy(this.iframeBus);
    this.grafanaRunTime.getBackendSrv = this.grafanaRunTime.getBackendSrv;
    //@ts-ignore
    window.grafanaRuntime = this.grafanaRunTime;
  }

  async handleMessage(message: SandboxMessage): Promise<SandboxMessage> {
    if (!this.isHandShakeDone) {
      return Promise.reject('not ready');
    }

    console.log('handling request from grafana', message);

    let response: SandboxMessage | undefined;

    response = await this.handleGrafanaRequest(message);
    if (response) {
      console.log('iframe replying with response', response);
      return response;
    }

    throw new Error('unknown message');
  }

  async handleGrafanaRequest(message: SandboxMessage): Promise<SandboxMessage | undefined> {
    switch (message.type) {
      case SandboxMessageType.DatasourceQuery: {
        return await this.handleDatasourceQuery(message);
      }

      case SandboxMessageType.DatasourceRenderQueryEditor: {
        return await this.handleDatasourceRenderQueryEditor(message);
      }
      // not a grafana request. Maybe a response to a request?
      default: {
        return;
      }
    }
  }

  async handleDatasourceRenderQueryEditor(message: SandboxMessage): Promise<SandboxMessage> {
    await this.waitForPluginReady();
    if (message.type !== SandboxMessageType.DatasourceRenderQueryEditor) {
      throw new Error('[never] no datasource instance');
    }

    const props = {
      ...message.payload,
      onChange: this.sendOnChangeQueryEditor.bind(this),
      onRunQuery: this.sendOnRunQueryEditor.bind(this),
    };

    //@ts-ignore
    const QueryEditor = this.plugin.components?.QueryEditor;

    ReactDOM.render(
      <div>
        <QueryEditor {...props} />
      </div>,
      this.appRoot
    );

    return {
      type: SandboxMessageType.Empty,
    };
  }

  async sendOnChangeQueryEditor(data: unknown) {
    this.iframeBus.postMessage({
      type: SandboxMessageType.DatasourceRenderQueryEditorEvent,
      payload: {
        event: 'onChange',
        args: data,
      },
    });
  }

  async sendOnRunQueryEditor() {
    this.iframeBus.postMessage({
      type: SandboxMessageType.DatasourceRenderQueryEditorEvent,
      payload: {
        event: 'onRunQuery',
        args: [],
      },
    });
  }

  async handleDatasourceQuery(message: SandboxDatasourceQueryMessage): Promise<SandboxDatasourceQueryResponse> {
    await this.waitForPluginReady();
    if (!this.datasourceInstance) {
      throw new Error('[never] no datasource instance');
    }

    const options = fromSandboxDataQueryRequestToDataQueryRequest(message.options);

    const response = (await this.datasourceInstance.query(options)) as DataQueryResponse;
    const data = response.data.map((frame: DataFrame) => {
      return dataFrameToJSON(frame);
    });
    response.data = data;
    return {
      type: SandboxMessageType.DatasourceQueryResponse,
      payload: response,
    };
  }

  async handshake() {
    const response = await this.iframeBus.postMessage({ type: SandboxMessageType.Handshake, id: this.bootData.id });
    if (response.type === SandboxMessageType.Handshake) {
      console.log('handshake done (plugin side)');
      this.isHandShakeDone = true;
      this.initPlugin();
    }
  }

  async initPlugin() {
    await this.injectPluginJs();
    this.plugin = await this.waitForPluginLoaded();
    this.instanciatePlugin();
    this.isReady = true;
  }

  injectPluginJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      const moduleJsFile = this.bootData.modulePath;
      // load moduleJsFile as a script
      const script = document.createElement('script');
      script.setAttribute('src', moduleJsFile);
      document.body.appendChild(script);

      //wait for it to load
      script.addEventListener('load', () => {
        resolve();
      });
      script.addEventListener('error', reject);
    });
  }

  waitForPluginLoaded(): Promise<GrafanaPlugin> {
    // check if window.plugin is defined for a max of 10 seconds
    return new Promise((resolve, reject) => {
      let count = 0;
      const interval = setInterval(() => {
        //@ts-ignore
        if (window.plugin) {
          clearInterval(interval);
          //@ts-ignore
          resolve(window.plugin);
        }
        if (count > 100) {
          clearInterval(interval);
          reject('plugin not ready');
        }
        count++;
      }, 100);
    });
  }

  waitForPluginReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const interval = setInterval(() => {
        if (this.isReady) {
          clearInterval(interval);
          resolve();
        }
        if (count > 300) {
          clearInterval(interval);
          reject('plugin not ready');
        }
        count++;
      }, 100);
    });
  }

  instanciatePlugin() {
    if (!this.plugin) {
      throw new Error('plugin not loaded');
    }
    if (this.bootData.meta.type === 'datasource' && this.bootData.instanceSettings) {
      //@ts-ignore
      const DatasourceClass: DataSourceConstructor = this.plugin.DataSourceClass;
      this.datasourceInstance = new DatasourceClass(this.bootData.instanceSettings);
      return;
    }
    throw new Error('not implemented');
  }
}

function main() {
  // @ts-ignore
  if (window.grafanaBootData) {
    // do not run in grafana main app
    return;
  }
  // @ts-ignore
  const bootData: SandboxGrafanaBootData = window.grafanaSandboxData;
  if (!bootData) {
    // do not run if not in sandbox
    return;
  }

  function messageHandler(event: MessageEvent) {
    if (event.data.type === SandboxMessageType.Init) {
      window.removeEventListener('message', messageHandler, false);
      const runtime = new SandboxRuntime({ port: event.ports[0], bootData: bootData });
      runtime.handshake();
    }
  }
  window.addEventListener('message', messageHandler, false);
}

main();
