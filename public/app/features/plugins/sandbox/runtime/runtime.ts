import { SandboxGrafanaBootData, SandboxMessageType } from '../types';

class SandboxRuntime {
  private port: MessagePort;
  private bootData: SandboxGrafanaBootData;
  private isHandShakeDone = false;
  private isReady = false;
  private key = 'no-key';

  constructor({ port, bootData }: { port: MessagePort; bootData: SandboxGrafanaBootData }) {
    this.port = port;
    this.bootData = bootData;
    this.port.onmessage = this.onMessage.bind(this);
  }
  onMessage = (event: MessageEvent) => {
    console.log('message', event);
    // do not process messages before handshake
    if (!this.isHandShakeDone && event.data.type !== SandboxMessageType.Handshake) {
      return;
    }

    if (!this.isHandShakeDone && event.data.type === SandboxMessageType.Handshake && event.data.key?.length > 0) {
      this.isHandShakeDone = true;
      this.key = event.data.key;
      this.initPlugin();
      console.log('handshake done (plugin side))');
      return;
    }
  };

  handShake() {
    this.port.postMessage({ type: 'handshake', id: this.bootData.id });
  }

  initPlugin() {
    console.log('initPlugin', this.bootData);
    this.isReady = true;
  }
}

function main() {
  // @ts-ignore
  const bootData: SandboxGrafanaBootData = window.grafanaSandboxData;
  if (!bootData) {
    return;
  }

  // @ts-ignore
  if (!window.grafanaSandboxData) {
    return;
  }

  // const runtime = new SandboxRuntime();
  // runtime.init();

  window.addEventListener('message', (event) => {
    console.log('message', event);
    if (event.data.type === SandboxMessageType.Init) {
      const runtime = new SandboxRuntime({ port: event.ports[0], bootData: bootData });
      runtime.handShake();
    }
  });
}

main();
