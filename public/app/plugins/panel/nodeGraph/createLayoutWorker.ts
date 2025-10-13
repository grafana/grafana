import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

export const createWorker = () => new Worker(new URL('./layout.worker.js', import.meta.url));
export const createMsaglWorker = () => new Worker(new URL('./layeredLayout.worker.js', import.meta.url));
