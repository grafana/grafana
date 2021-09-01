import { config } from '@grafana/runtime';
import NotificationsListPage from './NotificationsListPage';
import Receivers from './unified/Receivers';

// route between unified and "old" alerting pages based on feature flag

export default config.featureToggles.ngalert ? Receivers : NotificationsListPage;
