import {
  DashboardCursorSync,
  DashboardLink,
  FieldConfig,
  FieldConfigSource,
  TimePickerConfig,
  VariableModel,
} from '../index.gen';

export interface DashboardV2 {
  /**
   * Unique numeric identifier for the dashboard.
   * `id` is internal to a specific Grafana instance. `uid` should be used to identify a dashboard across Grafana instances.
   */
  id?: number | null; // TODO eliminate this null option
  /**
   * uid
   */
  uid?: string;
  /**
   * ID of a dashboard imported from the https://grafana.com/grafana/dashboards/ portal
   */
  gnetId?: string;
  /**
   * Description of dashboard.
   */
  description?: string;

  /**
   * Configuration of dashboard cursor sync behavior.
   * Accepted values are 0 (sync turned off), 1 (shared crosshair), 2 (shared crosshair and tooltip).
   */
  graphTooltip?: DashboardCursorSync;

  /**
   * Links with references to other dashboards or external websites.
   */
  links?: DashboardLink[];
  /**
   * When set to true, the dashboard will redraw panels at an interval matching the pixel width.
   * This will keep data "moving left" regardless of the query refresh rate. This setting helps
   * avoid dashboards presenting stale live data
   */
  liveNow?: boolean;
  /**
   * When set to true, the dashboard will load all panels in the dashboard when it's loaded.
   */
  preload?: boolean;
  /**
   * This property should only be used in dashboards defined by plugins.  It is a quick check
   * to see if the version has changed since the last time.
   */
  revision?: number;
  /**
   * Version of the JSON schema, incremented each time a Grafana update brings
   * changes to said schema.
   */
  schemaVersion: number;
  /**
   * Snapshot options. They are present only if the dashboard is a snapshot.
   */
  snapshot?: SnapshotMeta;
  /**
   * Tags associated with dashboard.
   */
  tags?: string[];
  /**
   * Configured template variables
   */
  variables: VariableModel[];
  /**
   * Time range for dashboard.
   * Accepted values are relative time strings like {from: 'now-6h', to: 'now'} or absolute time strings like {from: '2020-07-10T08:00:00.000Z', to: '2020-07-10T14:00:00.000Z'}.
   */
  time?: DashboardTimeSettings;
  /**
   * Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc".
   */
  timezone?: string;
  /**
   * Title of dashboard.
   */
  title?: string;
  /**
   * Version of the dashboard, incremented each time the dashboard is updated.
   */
  version?: number;
}

interface DashboardTimeSettings {
  from: string;
  to: string;
  /**
   * Whether timepicker is visible or not.
   */
  hidePicker?: boolean;
  /**
   * Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
   */
  nowDelay?: string;
  /**
   * Interval options available in the refresh picker dropdown.
   */
  autoRefreshIntervals?: string[];
  /**
   * Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.
   */
  quickRanges?: string[];
  /**
   * The month that the fiscal year starts on.  0 = January, 11 = December
   */
  fiscalYearStartMonth?: number;
  /**
   * Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".
   */
  weekStart?: string;
  /**
   * Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".
   */
  autoRefresh?: string;
}

interface SnapshotMeta {
  /**
   * Time when the snapshot was created
   */
  created: string;
  /**
   * Time when the snapshot expires, default is never to expire
   */
  expires: string;
  /**
   * Is the snapshot saved in an external grafana instance
   */
  external: boolean;
  /**
   * external url, if snapshot was shared in external grafana instance
   */
  externalUrl: string;
  /**
   * original url, url of the dashboard that was snapshotted
   */
  originalUrl: string;
  /**
   * Unique identifier of the snapshot
   */
  id: number;
  /**
   * Optional, defined the unique key of the snapshot, required if external is true
   */
  key: string;
  /**
   * Optional, name of the snapshot
   */
  name: string;
  /**
   * org id of the snapshot
   */
  orgId: number;
  /**
   * last time when the snapshot was updated
   */
  updated: string;
  /**
   * url of the snapshot, if snapshot was shared internally
   */
  url?: string;
  /**
   * user id of the snapshot creator
   */
  userId: number;
}

interface Panel {
  id?: string;
  title: string;
  description: string;
  vizConfig: PanelVizConfig;
}

interface PanelVizConfig {
  pluginId: string;
  pluginVersion?: string;
  options: unknown;
  fieldConfig: FieldConfigSource;
}

interface DefaultGridLayout {
  type: 'DefaultGrid';
  items: Array<DefaultGridItem | DefaultGridRow>;
}

interface DefaultGridItem {
  type: 'grid-item';
  panelRefId: string;
  repeatByVariable?: string;
}

interface DefaultGridRow {
  type: 'grid-row';
  repeatByVariable?: string;
  items: DefaultGridItem[];
}
