// Wrapped Worker constructor that allows cross-origin worker modules to be loaded in browsers.
// JSON.stringify escapes quotes/backslashes so scriptUrl can't break out of or inject into
// the generated import statement.
export class CorsWorker extends window.Worker {
  constructor(url: URL, options?: WorkerOptions) {
    const scriptUrl = url.toString();
    const objectURL = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(scriptUrl)};`], {
        type: 'application/javascript',
      })
    );
    super(objectURL, { ...options, type: 'module' });
    URL.revokeObjectURL(objectURL);
  }
}
