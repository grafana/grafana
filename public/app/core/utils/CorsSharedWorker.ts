export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

// Wrapped SharedWorker constructor that allows cross-origin worker modules to be loaded in browsers.
// JSON.stringify escapes quotes/backslashes so scriptUrl can't break out of or inject into
// the generated import statement.
// The worker revokes its own blob URL rather than the constructor doing it after construction:
// WebKit fails to start the worker when the blob is revoked before it has been read. Inside a
// blob worker `self.location.href` is that blob URL, and the import is hoisted, so the revoke
// runs only once the real worker script has evaluated.
export class CorsSharedWorker {
  constructor(url: URL, options?: WorkerOptions) {
    if (!sharedWorkersSupported()) {
      throw new Error('SharedWorker is not supported');
    }

    const scriptUrl = url.toString();
    const objectURL = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(scriptUrl)};URL.revokeObjectURL(self.location.href);`], {
        type: 'application/javascript',
      })
    );
    const worker = new SharedWorker(objectURL, { ...options, type: 'module' });

    // A worker that never starts never runs its own revoke, so cover that path here.
    worker.addEventListener('error', () => {
      URL.revokeObjectURL(objectURL);
    });

    return worker;
  }
}
