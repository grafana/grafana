export const createWorker = () => new Worker(new URL('./routeGroupsMatcher.worker.ts', import.meta.url));
