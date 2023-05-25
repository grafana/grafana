import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

// CorsWorker is needed as a workaround for CORS issue caused
// by static assets served from an url different from origin
export const createWorker = () => new Worker(new URL('./routeGroupsMatcher.worker.ts', import.meta.url));
