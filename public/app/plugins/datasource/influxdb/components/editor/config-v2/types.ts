import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

// As we're not using the auth component in `@grafana/plugin-ui`, we're defining the missing properties here
// to ensure the types are compatible with the existing code.
//
// They should be removed at a later point.

type InfluxBasicAuthData = {
  basicAuth?: boolean;
  basicAuthUser?: string;
};

type InfluxSecureBasicAuthData = {
  basicAuthPassword?: string;
};

export type Props = DataSourcePluginOptionsEditorProps<
  InfluxOptions & InfluxBasicAuthData,
  InfluxSecureJsonData & InfluxSecureBasicAuthData
>;
