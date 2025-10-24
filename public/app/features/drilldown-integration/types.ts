import { TimeRange } from '@grafana/data';
import { Panel } from '@grafana/schema';

export interface DrilldownOptions {
  isExternalApp: boolean;
}

export type PluginExtensionDrilldownContext = {
  panelData: DrilldownPanelData;
};

export type DrilldownPanelData = {
  panel: Panel;
  range: TimeRange;
};
