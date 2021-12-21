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

    // DOES NOT WORK
    // Blob URLs are unique and are tied to the lifecycle of the web app - https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
    //  => each new browsing context will create its own unique URL and therefore its own unique shared worker
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
