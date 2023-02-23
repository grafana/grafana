import { RawTimeRange, TimeZone } from '@grafana/data';

type Dashboard = {
  uid: string;
  title: string;
  tags: Readonly<Array<Readonly<string>>>;
};

type Target = {
  pluginId: string;
  refId: string;
};

export type PluginExtensionPanelContext = Readonly<{
  pluginId: string;
  id: number;
  title: string;
  timeRange: Readonly<RawTimeRange>;
  timeZone: TimeZone;
  dashboard: Readonly<Dashboard>;
  targets: Readonly<Array<Readonly<Target>>>;
}>;
