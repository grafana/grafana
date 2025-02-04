// Almost identical to CorsWorker.ts. Main difference being it allows loading a SharedWorker if browser supports it

export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

/**
 * Creating CorsSharedWorker should be called only if sharedWorkersSupported() is truthy
 */
export class CorsSharedWorker {
  constructor(url: URL, options?: WorkerOptions) {
    if (!sharedWorkersSupported()) {
      throw new Error('SharedWorker is not supported');
    }
    // by default, worker inherits HTML document's location and pathname which leads to wrong public path value
    // the CorsWorkerPlugin will override it with the value based on the initial worker chunk, ie.
    //    initial worker chunk: http://host.com/cdn/scripts/worker-123.js
    //    resulting public path: http://host.com/cdn/scripts

    const scriptUrl = url.toString();
    const scriptsBasePathUrl = new URL('.', url).toString();

    const importScripts = `importScripts('${scriptUrl}');`;
    const objectURL = URL.createObjectURL(
      new Blob([`__webpack_worker_public_path__ = '${scriptsBasePathUrl}'; ${importScripts}`], {
        type: 'application/javascript',
      })
    );
    const worker = new SharedWorker(objectURL, options);
    URL.revokeObjectURL(objectURL);
    return worker;
  }
}
