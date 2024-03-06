export const createWorker = () => new Worker(new URL('./DetectChangesWorker.ts', import.meta.url));
