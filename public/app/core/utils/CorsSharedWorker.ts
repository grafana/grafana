// works with webpack plugin: scripts/webpack/plugins/CorsWorkerPlugin.js
export class CorsSharedWorker extends SharedWorker {
  constructor(url: URL, options?: WorkerOptions) {
    // by default, worker inherits HTML document's location and pathname which leads to wrong public path value
    // the CorsWorkerPlugin will override it with the value based on the initial worker chunk, ie.
    //    initial worker chunk: http://host.com/cdn/scripts/worker-123.js
    //    resulting public path: http://host.com/cdn/scripts

    const scriptUrl = url.toString();
    const urlParts = scriptUrl.split('/');
    urlParts.pop();
    const scriptsBasePathUrl = `${urlParts.join('/')}/`;

    const source = `__webpack_worker_public_path__ = '${scriptsBasePathUrl}'; importScripts('${scriptUrl}');`;
    super(`data:application/javascript;base64,${btoa(source)}`, options);
  }
}
