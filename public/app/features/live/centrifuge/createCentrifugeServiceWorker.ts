import { corsWorker } from 'app/core/utils/CorsWorker';

import centrifugeWorkerUrl from './service.worker?worker&url';

export const createWorker = () => corsWorker(centrifugeWorkerUrl, { name: 'centrifuge' });
