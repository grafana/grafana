import { corsWorker } from 'app/core/utils/CorsWorker';

export const createWorker = () => corsWorker('./layout.worker.js', { name: 'nodeGraphLayout' });
export const createMsaglWorker = () => corsWorker('./layeredLayout.worker.js', { name: 'nodeGraphLayeredLayout' });
