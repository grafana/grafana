import { v4 as uuidv4 } from 'uuid';

import { DataSourceInstanceSettings, PluginMeta } from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';
import { instanceSettings } from 'app/features/expressions/ExpressionDatasource';

import { SandboxGrafanaBootData, SandboxMessageType } from './types';

export class IframeController {
  private iframe: HTMLIFrameElement;
  private channel: MessageChannel;
  private isHandShakeDone = false;
  private key: string;
  private isReady = false;
  private pluginMeta: PluginMeta;
  private instanceSettings?: DataSourceInstanceSettings;
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
    this.key = uuidv4();
    this.id = uuidv4();
    this.pluginMeta = pluginMeta;
    this.instanceSettings = instanceSettings;
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
      this.channel.port1.onmessage = this.onIframeMessage;
      this.iframe.contentWindow?.postMessage(
        {
          type: SandboxMessageType.Init,
          id: this.id,
        },
        // '*',
        window.location.origin,
        [this.channel.port2]
      );
    });

    // run the iframe
    window.document.body.appendChild(this.iframe);
  }

  onIframeMessage = (event: MessageEvent) => {
    // do not process any messages before handshake
    if (!this.isHandShakeDone && event.data.type !== SandboxMessageType.Handshake) {
      return;
    }

    if (!this.isHandShakeDone && event.data.type === SandboxMessageType.Handshake && event.data.id === this.id) {
      this.isHandShakeDone = true;
      this.channel.port1.postMessage({
        type: SandboxMessageType.Handshake,
        key: this.key,
      });
      console.log('handshake done (grafana side)');
      return;
    }
  };

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
        </head>
        <body>
      </html>
      `;
    return srcDoc;
  }
}
