import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

// CorsWorker is needed as a workaround for CORS issue caused
// by static assets server from a different domain than origin
export const createWorker = () => new Worker(new URL('./routeGroupsMatcher.worker.ts', import.meta.url));
