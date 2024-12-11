export function sharedWorkersSupported() {
  return typeof window.SharedWorker !== 'undefined';
}

// This function is used to create a sharedworker that can load across domains.
export function corsSharedWorker(workerUrl: string, options: WorkerOptions) {
  const js = `import ${JSON.stringify(new URL(workerUrl, import.meta.url))}`;
  const blob = new Blob([js], { type: 'application/javascript' });
  const objURL = URL.createObjectURL(blob);
  const worker = new SharedWorker(objURL, { type: 'module', name: options?.name });
  worker.addEventListener('error', (e) => {
    URL.revokeObjectURL(objURL);
  });
  return worker;
}
