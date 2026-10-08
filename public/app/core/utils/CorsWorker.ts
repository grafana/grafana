// Wrapped Worker constructor that allows cross-origin worker modules to be loaded in browsers.
// JSON.stringify escapes quotes/backslashes so scriptUrl can't break out of or inject into
// the generated import statement.
// The worker revokes its own blob URL rather than the constructor doing it after super():
// WebKit fails to start the worker when the blob is revoked before it has been read. Inside a
// blob worker `self.location.href` is that blob URL, and the import is hoisted, so the revoke
// runs only once the real worker script has evaluated.
export class CorsWorker extends window.Worker {
  constructor(url: URL, options?: WorkerOptions) {
    const scriptUrl = url.toString();
    const objectURL = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(scriptUrl)};URL.revokeObjectURL(self.location.href);`], {
        type: 'application/javascript',
      })
    );
    super(objectURL, { ...options, type: 'module' });

    // A worker that never starts never runs its own revoke, so cover that path here.
    this.addEventListener('error', () => {
      URL.revokeObjectURL(objectURL);
    });
  }
}
