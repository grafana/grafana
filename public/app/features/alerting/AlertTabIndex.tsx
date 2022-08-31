import { config } from '@grafana/runtime';

import { AlertTab } from './AlertTab';
import { PanelAlertTabContent } from './unified/PanelAlertTabContent';

// route between unified and "old" alerting pages based on feature flag

export default config.unifiedAlertingEnabled ? PanelAlertTabContent : AlertTab;
