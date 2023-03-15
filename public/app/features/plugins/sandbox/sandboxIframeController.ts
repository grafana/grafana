import { DataSourceInstanceSettings, PluginMeta } from '@grafana/data';
import { config, getBackendSrv, GrafanaBootConfig } from '@grafana/runtime';

import { IFrameBus } from './iframeBus/iframeBus';
import { SandboxGrafanaBootData, SandboxMessage, SandboxMessageType } from './types';

export class IframeController {
  private id: string;
  private iframe: HTMLIFrameElement;
  private channel: MessageChannel;
  private isHandShakeDone = false;
  private pluginMeta: PluginMeta;
  private instanceSettings?: DataSourceInstanceSettings;
  private iframeBus: IFrameBus<SandboxMessage>;

  constructor({
    pluginMeta,
    instanceSettings,
  }: {
    pluginMeta: PluginMeta;
    instanceSettings?: DataSourceInstanceSettings;
  }) {
    this.iframe = document.createElement('iframe');
    this.channel = new MessageChannel();
    this.id = pluginMeta.id;
    this.pluginMeta = pluginMeta;
    this.instanceSettings = instanceSettings;
    this.iframeBus = new IFrameBus<SandboxMessage>({
      port: this.channel.port1,
      onMessage: this.handleMessage.bind(this),
    });
  }

  async handleMessage(message: SandboxMessage): Promise<SandboxMessage> {
    // reject all messages before handshake is done except handshake
    if (!this.isHandShakeDone && message.type !== SandboxMessageType.Handshake) {
      throw new Error('Handshake not done. Cannot handle message');
    }

    // handle handshake message
    if (!this.isHandShakeDone && message.type === SandboxMessageType.Handshake) {
      return this.handleHandshake(message);
    }

    let response: SandboxMessage | undefined;
    response = await this.handleIframeRequest(message);
    if (response) {
      console.log('grafana replying with response', response);
      return response;
    }

    throw new Error('unknown message');
  }

  async sendRequest(message: SandboxMessage): Promise<SandboxMessage> {
    await this.waitForIframeReady();
    return this.iframeBus.postMessage(message);
  }

  async handleIframeRequest(message: SandboxMessage): Promise<SandboxMessage | undefined> {
    console.log('handling iframe request', message);
    switch (message.type) {
      case SandboxMessageType.DatasourceBackendSrvRequest:
        return this.handleDatasourceBackendSrvRequest(message);
    }
    throw new Error('not implemented');
  }

  async handleDatasourceBackendSrvRequest(message: SandboxMessage): Promise<SandboxMessage> {
    if (message.type !== SandboxMessageType.DatasourceBackendSrvRequest) {
      throw new Error('not a datasource backend srv request');
    }
    try {
      const response = await getBackendSrv().request(message.payload);
      return {
        type: SandboxMessageType.DatasourceBackendSrvResponse,
        payload: response,
      };
    } catch (err) {
      throw err;
    }
  }

  async handleHandshake(message: SandboxMessage): Promise<SandboxMessage> {
    if (message.type !== SandboxMessageType.Handshake) {
      throw new Error('not a handshake message');
    }

    if (message.id !== this.id) {
      throw new Error('handshake id does not match');
    }

    console.log('handshake done (grafana side)');
    this.isHandShakeDone = true;

    return {
      type: SandboxMessageType.Handshake,
      id: this.id,
    };
  }

  setupSandbox() {
    const srcDoc = this.getSrcDoc({
      bootConfig: config,
      pluginMeta: this.pluginMeta,
      instanceSettings: this.instanceSettings,
    });

    this.iframe.className = 'sandbox-iframe';
    this.iframe.srcdoc = srcDoc;
    this.iframe.style.display = 'none';
    this.iframe.id = 'sandbox-iframe-' + this.id;

    this.iframe.addEventListener('load', () => {
      this.iframe.contentWindow?.postMessage(
        {
          type: SandboxMessageType.Init,
          id: this.id,
        },
        window.location.origin,
        [this.channel.port2]
      );
    });

    // run the iframe
    window.document.body.appendChild(this.iframe);
  }

  async waitForIframeReady(): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.isHandShakeDone) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  getSrcDoc({
    bootConfig,
    pluginMeta,
    instanceSettings,
  }: {
    bootConfig: GrafanaBootConfig;
    pluginMeta: PluginMeta;
    instanceSettings?: DataSourceInstanceSettings;
  }) {
    const sandboxBootData: SandboxGrafanaBootData = {
      id: this.id,
      instanceSettings,
      meta: pluginMeta,
      isSandbox: true,
      isDev: bootConfig.buildInfo.env === 'development',
      modulePath: bootConfig.appSubUrl + '/public/' + pluginMeta.module + '.js',
    };
    const srcDoc = `
      <html>
        <head>
          <script>
            window.grafanaSandboxData = ${JSON.stringify(sandboxBootData)};
          </script>
          <script src="${bootConfig.appSubUrl}/public/build/runtime~sandboxRuntime.js"></script>
          <script src="${bootConfig.appSubUrl}/public/build/sandboxRuntime.js"></script>
          <link rel="preload" href="${bootConfig.appSubUrl}/public/${pluginMeta.module}.js"></script>
        </head>
        <body>
      </html>
      `;
    return srcDoc;
  }
}
