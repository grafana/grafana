// Almost identical to CorsWorker.ts. Main difference being it allows loading a SharedWorker if browser supports it

export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

class SharedWorkerNotSupported implements SharedWorker {
  onerror() {}
  // @ts-ignore
  readonly port: MessagePort;
  dispatchEvent(): boolean {
    return false;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}
const BaseSharedWorkerClass = sharedWorkersSupported() ? window.SharedWorker : SharedWorkerNotSupported;

export class CorsSharedWorker extends BaseSharedWorkerClass {
  constructor(url: URL, options?: WorkerOptions) {
    // by default, worker inherits HTML document's location and pathname which leads to wrong public path value
    // the CorsWorkerPlugin will override it with the value based on the initial worker chunk, ie.
    //    initial worker chunk: http://host.com/cdn/scripts/worker-123.js
    //    resulting public path: http://host.com/cdn/scripts

    const scriptUrl = url.toString();
    const urlParts = scriptUrl.split('/');
    urlParts.pop();
    const scriptsBasePathUrl = `${urlParts.join('/')}/`;

    const importScripts = `importScripts('${scriptUrl}');`;
    const objectURL = URL.createObjectURL(
      new Blob([`__webpack_worker_public_path__ = '${scriptsBasePathUrl}'; ${importScripts}`], {
        type: 'application/javascript',
      })
    );
    super(objectURL, options);
    URL.revokeObjectURL(objectURL);
  }
}
