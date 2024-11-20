import * as React from 'react';

import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { ScopedVars } from './ScopedVars';
import { DataSourcePluginMeta, DataSourceSettings } from './datasource';
import { IconName } from './icon';
import { PanelData } from './panel';
import { RawTimeRange, TimeZone } from './time';

// Plugin Extensions types
// ---------------------------------------

export enum PluginExtensionTypes {
  link = 'link',
  component = 'component',
}

type PluginExtensionBase = {
  id: string;
  type: PluginExtensionTypes;
  title: string;
  description: string;
  pluginId: string;
};
export type PluginExtensionLink = PluginExtensionBase & {
  type: PluginExtensionTypes.link;
  path?: string;
  onClick?: (event?: React.MouseEvent) => void;
  icon?: IconName;
  category?: string;
};

export type PluginExtensionComponent<Props = {}> = PluginExtensionBase & {
  type: PluginExtensionTypes.component;
  component: React.ComponentType<Props>;
};

export type PluginExtension = PluginExtensionLink | PluginExtensionComponent;

// Objects used for registering extensions (in app plugins)
// --------------------------------------------------------

type PluginExtensionConfigBase = {
  /**
   * The title of the link extension
   */
  title: string;

  /**
   * A short description
   */
  description?: string;
};

export type PluginExtensionAddedComponentConfig<Props = {}> = PluginExtensionConfigBase & {
  /**
   * The target extension points where the component will be added
   */
  targets: string | string[];

  /**
   * The title of the component
   */
  title: string;

  /**
   * A short description of the component
   */
  description: string;

  /**
   * The React component that will added to the target extension points
   */
  component: React.ComponentType<Props>;
};

export type PluginAddedLinksConfigureFunc<Context extends object> = (context: Readonly<Context> | undefined) =>
  | Partial<{
      title: string;
      description: string;
      path: string;
      onClick: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
      icon: IconName;
      category: string;
    }>
  | undefined;

export type PluginExtensionAddedLinkConfig<Context extends object = object> = PluginExtensionConfigBase & {
  /**
   * The target extension points where the link will be added
   */
  targets: string | string[];

  /** A URL path that will be used as the href for the rendered link extension
   * (It is optional, because in some cases the action will be handled by the `onClick` handler instead of navigating to a new page)
   */
  path?: string;

  /** A URL path that will be used as the href for the rendered link extension
   * (It is optional, because in some cases the action will be handled by the `onClick` handler instead of navigating to a new page)
   * path?: string;
   *
   * A function that will be called when the link is clicked
   *  (It is called with the original event object)
   */
  onClick?: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;

  // (Optional) A function that can be used to configure the extension dynamically based on the extension point's context
  configure?: PluginAddedLinksConfigureFunc<Context>;

  // (Optional) A icon that can be displayed in the ui for the extension option.
  icon?: IconName;

  // (Optional) A category to be used when grouping the options in the ui
  category?: string;
};

export type PluginExtensionExposedComponentConfig<Props = {}> = PluginExtensionConfigBase & {
  /**
   * The unique identifier of the component
   * Shoud be in the format of `<pluginId>/<componentName>/<componentVersion>`. e.g. `myorg-todo-app/todo-list/v1`
   */
  id: string;

  /**
   * The React component that will be exposed to other plugins
   */
  component: React.ComponentType<Props>;
};

export type PluginExtensionConfig = PluginExtensionLinkConfig | PluginExtensionComponentConfig;

export type PluginExtensionOpenModalOptions = {
  // The title of the modal
  title: string;
  // A React element that will be rendered inside the modal
  body: React.ElementType<{ onDismiss?: () => void }>;
  // Width of the modal in pixels or percentage
  width?: string | number;
  // Height of the modal in pixels or percentage
  height?: string | number;
};

export type PluginExtensionEventHelpers<Context extends object = object> = {
  context?: Readonly<Context>;
  // Opens a modal dialog and renders the provided React component inside it
  openModal: (options: PluginExtensionOpenModalOptions) => void;
};

// Extension Points & Contexts
// --------------------------------------------------------

// Extension Points available in core Grafana
export enum PluginExtensionPoints {
  AlertInstanceAction = 'grafana/alerting/instance/action',
  AlertingHomePage = 'grafana/alerting/home',
  AlertingAlertingRuleAction = 'grafana/alerting/alertingrule/action',
  AlertingRecordingRuleAction = 'grafana/alerting/recordingrule/action',
  CommandPalette = 'grafana/commandpalette/action',
  DashboardPanelMenu = 'grafana/dashboard/panel/menu',
  DataSourceConfig = 'grafana/datasources/config',
  ExploreToolbarAction = 'grafana/explore/toolbar/action',
  UserProfileTab = 'grafana/user/profile/tab',
}

export type PluginExtensionPanelContext = {
  pluginId: string;
  id: number;
  title: string;
  timeRange: RawTimeRange;
  timeZone: TimeZone;
  dashboard: Dashboard;
  targets: DataQuery[];
  scopedVars?: ScopedVars;
  data?: PanelData;
};

export type PluginExtensionDataSourceConfigContext<JsonData extends DataSourceJsonData = DataSourceJsonData> = {
  // The current datasource settings
  dataSource: DataSourceSettings<JsonData>;

  // Meta information about the datasource plugin
  dataSourceMeta: DataSourcePluginMeta;

  // Testing status
  testingStatus?: {
    message?: string | null;
    status?: string | null;
  };

  // Can be used to update the `jsonData` field on the datasource
  // (Only updates the form, it still needs to be saved by the user)
  setJsonData: (jsonData: JsonData) => void;
};

export type PluginExtensionCommandPaletteContext = {};

type Dashboard = {
  uid: string;
  title: string;
  tags: string[];
};

// deprecated types

/** @deprecated - use PluginExtensionAddedLinkConfig instead */
export type PluginExtensionLinkConfig<Context extends object = object> = {
  type: PluginExtensionTypes.link;
  title: string;
  description: string;

  // A URL path that will be used as the href for the rendered link extension
  // (It is optional, because in some cases the action will be handled by the `onClick` handler instead of navigating to a new page)
  path?: string;

  // A function that will be called when the link is clicked
  // (It is called with the original event object)
  onClick?: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;

  /**
   * The unique identifier of the Extension Point
   * (Core Grafana extension point ids are available in the `PluginExtensionPoints` enum)
   */
  extensionPointId: string;

  // (Optional) A function that can be used to configure the extension dynamically based on the extension point's context
  configure?: (context?: Readonly<Context>) =>
    | Partial<{
        title: string;
        description: string;
        path: string;
        onClick: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
        icon: IconName;
        category: string;
      }>
    | undefined;

  // (Optional) A icon that can be displayed in the ui for the extension option.
  icon?: IconName;

  // (Optional) A category to be used when grouping the options in the ui
  category?: string;
};

/** @deprecated - use PluginAddedLinkConfig instead */
export type PluginExtensionComponentConfig<Props = {}> = {
  type: PluginExtensionTypes.component;
  title: string;
  description: string;

  // The React component that will be rendered as the extension
  // (This component receives contextual information as props when it is rendered. You can just return `null` from the component to hide it.)
  component: React.ComponentType<Props>;

  /**
   * The unique identifier of the Extension Point
   * (Core Grafana extension point ids are available in the `PluginExtensionPoints` enum)
   */
  extensionPointId: string;
};
