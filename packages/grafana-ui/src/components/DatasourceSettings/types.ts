import { DataSourceSettings } from '../../types/datasource';

export interface DatasourceHttpSettingsBaseProps {
  datasourceConfig: DataSourceSettings<any, any>;
  onChange: (config: DataSourceSettings) => void;
}

export interface DatasourceHttpSettingsProps extends DatasourceHttpSettingsBaseProps {
  defaultUrl: string;
  showAccessOptions?: boolean;
  // Not sure these two should belong here, could be handled by onChange only
  // Depends on how compatible with the current directive we wanna be
  onBasicAuthPasswordReset: any; // TODO type this
  onBasicAuthPasswordChange: any; // TODO type this
}
