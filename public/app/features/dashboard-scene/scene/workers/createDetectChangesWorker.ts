export const createWorker = () =>
  new Worker(new URL('./DetectChangesWorker.ts', require('url').pathToFileURL(__filename).toString()));
