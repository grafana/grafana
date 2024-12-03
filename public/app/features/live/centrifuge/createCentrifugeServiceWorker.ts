import { corsWorker } from 'app/core/utils/CorsWorker';

export const createWorker = () => corsWorker('./service.worker.ts', { name: 'centrifuge' });
