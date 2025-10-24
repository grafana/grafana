import { TimeRange } from '@grafana/data';
import { Panel } from '@grafana/schema';

export type PluginExtensionDrilldownContext = {
  panelData: DrilldownPanelData;
};

export type DrilldownPanelData = {
  panel: Panel;
  range: TimeRange;
};
