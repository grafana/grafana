// Browsers refuse to start a worker from another origin, such as the CDN, so this starts a
// same-origin blob worker that imports the real script. JSON.stringify escapes the URL so it
// cannot break out of the import statement.
// The worker revokes its own blob URL because WebKit fails to start a worker whose blob was
// revoked before it was read. The import is hoisted, so the revoke runs after the real script.
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
