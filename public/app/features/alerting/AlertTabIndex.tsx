import { config } from '@grafana/runtime';
import { AlertTab } from './AlertTab';
import { PanelAlertTab } from './unified/PanelAlertTab';

// route between unified and "old" alerting pages based on feature flag

export default config.featureToggles.ngalert ? PanelAlertTab : AlertTab;
