import { EntityState } from '@reduxjs/toolkit';

import {
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourceSettings,
  LayoutMode,
} from '@grafana/data';

export type GenericDataSourcePlugin = DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>>;

export type DataSourceRights = {
  readOnly: boolean;
  hasWriteRights: boolean;
  hasDeleteRights: boolean;
};

export type DataSourcesRoutes = {
  New: string;
  Edit: string;
  List: string;
  Dashboards: string;
};

export enum RequestStatus {
  Pending = 'Pending',
  Fulfilled = 'Fulfilled',
  Rejected = 'Rejected',
}

export type RequestInfo = {
  status: RequestStatus;
  // The whole error object
  error?: any;
  // An optional error message
  errorMessage?: string;
};

export type DataSourcesState = {
  // All the datasource instances loaded in the client side
  items: EntityState<DataSourceSettings>;

  // Stores request status information (requests for fetching / creating / updating / deleting datasources)
  requests: Record<string, RequestInfo>;

  // Visual settings
  settings: {
    // Contains the search query to filter datasources by
    searchQuery?: string;

    // Used to specify the visual layout for the datasources on the screen
    layoutMode: LayoutMode;
  };

  // OLD
  // dataSources: DataSourceSettings[];
  // searchQuery: string;
  // dataSourceTypeSearchQuery: string;
  // layoutMode: LayoutMode;
  // dataSourcesCount: number;
  // dataSource: DataSourceSettings;
  // dataSourceMeta: DataSourcePluginMeta;
  // hasFetched: boolean;
  // isLoadingDataSources: boolean;
  // plugins: DataSourcePluginMeta[];
  // categories: DataSourcePluginCategory[];
};
