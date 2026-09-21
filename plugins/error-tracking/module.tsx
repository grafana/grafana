import { AppPlugin } from '@grafana/data';

import ErrorTrackingPage from './src/ErrorTrackingPage';

export const plugin = new AppPlugin<{}>().setRootPage(() => <ErrorTrackingPage />);
