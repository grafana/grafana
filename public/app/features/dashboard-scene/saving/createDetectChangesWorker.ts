import { corsWorker } from 'app/core/utils/CorsWorker';

export const createWorker = () => corsWorker('./DetectChangesWorker.ts', { name: 'detectChanges' });
