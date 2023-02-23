import { RawTimeRange, TimeZone } from '@grafana/data';

type Dashboard = {
  uid: string;
  title: string;
  tags: string[];
};

type Target = {
  pluginId: string;
  refId: string;
};

export type PluginExtensionPanelContext = {
  pluginId: string;
  id: number;
  title: string;
  timeRange: RawTimeRange;
  timeZone: TimeZone;
  dashboard: Dashboard;
  targets: Target[];
};
