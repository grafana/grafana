import { DataFrame, dataFrameToJSON, DataQueryResponse, DataSourceApi, GrafanaPlugin } from '@grafana/data';

import { fromSandboxDataQueryRequestToDataQueryRequest } from '../sandboxSerializer';
import {
  SandboxDatasourceQueryMessage,
  SandboxDatasourceQueryResponse,
  SandboxGrafanaBootData,
  SandboxMessageType,
  SandboxMessageWrapper,
} from '../types';

class SandboxRuntime {
  private port: MessagePort;
  private bootData: SandboxGrafanaBootData;
  private isHandShakeDone = false;
  private isReady = false;
  private plugin?: GrafanaPlugin;
  private datasourceInstance?: DataSourceApi;

  constructor({ port, bootData }: { port: MessagePort; bootData: SandboxGrafanaBootData }) {
    this.port = port;
    this.bootData = bootData;
    this.port.onmessage = this.onMessage.bind(this);
  }

  async onMessage(event: MessageEvent) {
    if (this.handleHandshake(event)) {
      return;
    }

    const messageWrapper: SandboxMessageWrapper = event.data;
    console.log('iframe got a message message', messageWrapper);

    switch (messageWrapper.message.type) {
      case SandboxMessageType.DatasourceQuery: {
        const dataQueryResponse = await this.handleDatasourceQuery(messageWrapper.message);
        const response = {
          uid: messageWrapper.uid,
          message: dataQueryResponse,
        };
        console.log('iframe replying with response', response);
        this.postMessage(response);
        break;
      }
      default: {
        console.log('unknown message', messageWrapper);
        break;
      }
    }
  }

  postMessage(message: SandboxMessageWrapper) {
    this.port.postMessage(message);
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

  handleHandshake(event: MessageEvent) {
    // do not process messages before handshake
    if (!this.isHandShakeDone && event.data.type !== SandboxMessageType.Handshake) {
      return true;
    }

    if (!this.isHandShakeDone && event.data.type === SandboxMessageType.Handshake) {
      console.log('handshake done (iframe side)');
      this.isHandShakeDone = true;
      this.initPlugin();
      return true;
    }
    return false;
  }

  snedHandShake() {
    this.port.postMessage({ type: SandboxMessageType.Handshake, id: this.bootData.id });
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
      runtime.snedHandShake();
    }
  }
  window.addEventListener('message', messageHandler, false);
}

main();
