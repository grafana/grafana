// This function is used to create a worker that can load across domains.
// To use it, you need to import the workerUrl and pass it as the first argument.
//
// import clientWorkerUrl from './client.worker?worker&url';
//
// corsWorker(clientWorkerUrl, { name: 'myWorker' });
//
export function corsWorker(workerUrl: string, options: WorkerOptions) {
  const js = `import ${JSON.stringify(new URL(workerUrl, import.meta.url))}`;
  const blob = new Blob([js], { type: 'application/javascript' });
  const objURL = URL.createObjectURL(blob);
  const worker = new Worker(objURL, { type: 'module', name: options?.name });
  worker.addEventListener('error', (e) => {
    URL.revokeObjectURL(objURL);
  });
  return worker;
}
