import { v4 as uuidv4 } from 'uuid';

import { DataSourceInstanceSettings, PluginMeta } from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';

import { SandboxGrafanaBootData, SandboxMessage, SandboxMessageType, SandboxMessageWrapper } from './types';

export class IframeController {
  private iframe: HTMLIFrameElement;
  private channel: MessageChannel;
  private isHandShakeDone = false;
  private pluginMeta: PluginMeta;
  private instanceSettings?: DataSourceInstanceSettings;
  private outboundMessages: Record<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timestamp: number;
    }
  > = {};
  id: string;

  constructor({
    pluginMeta,
    instanceSettings,
  }: {
    pluginMeta: PluginMeta;
    instanceSettings?: DataSourceInstanceSettings;
  }) {
    this.iframe = document.createElement('iframe');
    this.channel = new MessageChannel();
    this.id = uuidv4();
    this.pluginMeta = pluginMeta;
    this.instanceSettings = instanceSettings;
    this.sendMessage = this.sendMessage.bind(this);
  }

  async sendMessage(message: SandboxMessage): Promise<any> {
    await this.waitForIframeReady();
    return new Promise((resolve, reject) => {
      const uid = uuidv4();

      const wrappedMessage: SandboxMessageWrapper = {
        uid: uid,
        message,
      };

      this.outboundMessages[uid] = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      console.log('grafana sending message', wrappedMessage);

      this.channel.port1.postMessage(wrappedMessage);
    });
  }

  onIframeMessage(event: MessageEvent) {
    if (this.handleHandshake(event)) {
      return;
    }
    const data: SandboxMessageWrapper = event.data;
    console.log('grafana got a message', event.data);

    const { uid, message } = data;

    if (this.outboundMessages[uid]) {
      const { resolve, reject } = this.outboundMessages[uid];
      delete this.outboundMessages[uid];

      if (message.type === SandboxMessageType.Error) {
        reject(message.payload);
      } else {
        switch (message.type) {
          case SandboxMessageType.DatasourceQueryResponse: {
            resolve(message.payload);
            break;
          }
          default: {
            resolve([]);
            break;
          }
        }
      }
    }
  }

  handleHandshake(event: MessageEvent) {
    // do not process any messages before handshake
    if (!this.isHandShakeDone && event.data.type !== SandboxMessageType.Handshake) {
      return true;
    }

    if (!this.isHandShakeDone && event.data.type === SandboxMessageType.Handshake && event.data.id === this.id) {
      this.isHandShakeDone = true;
      this.channel.port1.postMessage({
        type: SandboxMessageType.Handshake,
      });
      console.log('handshake done (grafana side)');
      return true;
    }
    return false;
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
      this.channel.port1.onmessage = this.onIframeMessage.bind(this);
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
