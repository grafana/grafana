import { corsWorker } from 'app/core/utils/CorsWorker';

import matcherWorkerUrl from './routeGroupsMatcher.worker?worker&url';

// CorsWorker is needed as a workaround for CORS issue caused
// by static assets served from an url different from origin
export const createWorker = () => corsWorker(matcherWorkerUrl, { name: 'routeGroupsMatcher' });
