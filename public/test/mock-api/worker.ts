import { setupWorker } from 'msw/browser';

import allHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';

export default setupWorker(...allHandlers);
