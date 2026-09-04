export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

// Wrapped SharedWorker constructor that allows cross-origin worker modules to be loaded in browsers.
// JSON.stringify escapes quotes/backslashes so scriptUrl can't break out of or inject into
// the generated import statement.
export class CorsSharedWorker {
  constructor(url: URL, options?: WorkerOptions) {
    if (!sharedWorkersSupported()) {
      throw new Error('SharedWorker is not supported');
    }

    const scriptUrl = url.toString();
    const objectURL = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(scriptUrl)};`], {
        type: 'application/javascript',
      })
    );
    const worker = new SharedWorker(objectURL, { ...options, type: 'module' });
    URL.revokeObjectURL(objectURL);
    return worker;
  }
}
