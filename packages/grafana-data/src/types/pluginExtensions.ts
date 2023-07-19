import React from 'react';

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
};

export type PluginExtensionComponent = PluginExtensionBase & {
  type: PluginExtensionTypes.component;
  component: React.ComponentType;
};

export type PluginExtension = PluginExtensionLink | PluginExtensionComponent;

// Objects used for registering extensions (in app plugins)
// --------------------------------------------------------
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

  // The unique identifier of the Extension Point
  // (Core Grafana extension point ids are available in the `PluginExtensionPoints` enum)
  extensionPointId: string;

  // (Optional) A function that can be used to configure the extension dynamically based on the extension point's context
  configure?: (context?: Readonly<Context>) =>
    | Partial<{
        title: string;
        description: string;
        path: string;
        onClick: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
        icon: IconName;
      }>
    | undefined;

  // (Optional) A icon that can be displayed in the ui for the extension option.
  icon?: IconName;
};

export type PluginExtensionComponentConfig<Context extends object = object> = {
  type: PluginExtensionTypes.component;
  title: string;
  description: string;

  // The React component that will be rendered as the extension
  // (This component receives the context as a prop when it is rendered. You can just return `null` from the component to hide for certain contexts)
  component: React.ComponentType;

  // The unique identifier of the Extension Point
  // (Core Grafana extension point ids are available in the `PluginExtensionPoints` enum)
  extensionPointId: string;
};

export type PluginExtensionConfig = PluginExtensionLinkConfig | PluginExtensionComponentConfig;

export type PluginExtensionEventHelpers<Context extends object = object> = {
  context?: Readonly<Context>;
  // Opens a modal dialog and renders the provided React component inside it
  openModal: (options: {
    // The title of the modal
    title: string;
    // A React element that will be rendered inside the modal
    body: React.ElementType<{ onDismiss?: () => void }>;
  }) => void;
};

// Extension Points & Contexts
// --------------------------------------------------------

// Extension Points available in core Grafana
export enum PluginExtensionPoints {
  DashboardPanelMenu = 'grafana/dashboard/panel/menu',
  DataSourceConfig = 'grafana/datasources/config',
  ExploreToolbarAction = 'grafana/explore/toolbar/action',
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

type Dashboard = {
  uid: string;
  title: string;
  tags: string[];
};
