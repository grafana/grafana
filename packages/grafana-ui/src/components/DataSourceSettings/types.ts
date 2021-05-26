import { DataSourceSettings } from '@grafana/data';

export interface HttpSettingsBaseProps {
  /** The configuration object of the data source */
  dataSourceConfig: DataSourceSettings<any, any>;
  /** Callback for handling changes to the configuration object */
  onChange: (config: DataSourceSettings) => void;
}

export interface HttpSettingsProps extends HttpSettingsBaseProps {
  /** The default url for the data source */
  defaultUrl: string;
  /** Show the http access help box */
  showAccessOptions?: boolean;
  /** Show the SigV4 auth toggle option */
  sigV4AuthToggleEnabled?: boolean;
}
