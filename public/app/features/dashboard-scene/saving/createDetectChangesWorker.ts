import { corsWorker } from 'app/core/utils/CorsWorker';

import detectChangesWorkerUrl from './DetectChangesWorker?worker&url';

export const createWorker = () => corsWorker(detectChangesWorkerUrl, { name: 'detectChanges' });
