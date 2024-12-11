import { corsWorker } from 'app/core/utils/CorsWorker';

import layeredLayoutWorkerUrl from './layeredLayout.worker?worker&url';
import layoutWorkerUrl from './layout.worker?worker&url';

export const createWorker = () => corsWorker(layoutWorkerUrl, { name: 'nodeGraphLayout' });
export const createMsaglWorker = () => corsWorker(layeredLayoutWorkerUrl, { name: 'nodeGraphLayeredLayout' });
