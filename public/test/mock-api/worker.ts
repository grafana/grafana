import { setupWorker } from 'msw/browser';

import allAlertingHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';
import allBrowseDashboardsHandlers from 'app/features/browse-dashboards/new-api/mocks/handlers';

export default setupWorker(...allAlertingHandlers, ...allBrowseDashboardsHandlers);
