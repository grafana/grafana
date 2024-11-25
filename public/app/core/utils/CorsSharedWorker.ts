// Almost identical to CorsWorker.ts. Main difference being it allows loading a SharedWorker if browser supports it

export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

/**
 * The base class is created dynamically here to allow later on syntax like:
 * import { CorsSharedWorker as SharedWorker } from '../utils/CorsSharedWorker';
 * And also take into account cases where SharedWorked is not available in the browser (mainly mobile browsers)
 *
 * It's important to use: new SharedWorker(...) syntax instead of new CorsSharedWorker(...) due to how web-workers
 * are processing workers syntax (more details https://webpack.js.org/guides/web-workers/)
 */
const BaseSharedWorkerClass = sharedWorkersSupported() ? window.SharedWorker : null;

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
