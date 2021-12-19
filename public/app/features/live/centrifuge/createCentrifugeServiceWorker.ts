import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';
import type { Endpoint } from 'comlink';

export const createWorker = (): Endpoint =>
  new Worker(new URL('./service.worker.ts', import.meta.url), { name: 'CentrifugeService' });
