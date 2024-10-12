import { setupWorker } from 'msw/browser';

import allAlertingHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';

export default setupWorker(...allAlertingHandlers);
