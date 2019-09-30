import { DataSourceSettings } from '../../types';

export interface HttpSettingsBaseProps {
  dataSourceConfig: DataSourceSettings<any, any>;
  onChange: (config: DataSourceSettings) => void;
}

export interface HttpSettingsProps extends HttpSettingsBaseProps {
  defaultUrl: string;
  showAccessOptions?: boolean;
  // Not sure these two should belong here, could be handled by onChange only
  // Depends on how compatible with the current directive we wanna be
  onBasicAuthPasswordReset: any; // TODO type this
  onBasicAuthPasswordChange: any; // TODO type this
}
