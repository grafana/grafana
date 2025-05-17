import { DataSourceJsonData, DataSourceOptionsType } from '@grafana/data';

export interface ConfigEditorProps<T extends DataSourceJsonData = DataSourceJsonData, S = {}> {
  options: DataSourceOptionsType<T>;
  onOptionsChange: (options: DataSourceOptionsType<T>) => void;
}

export interface AlertingSettingsProps<T extends DataSourceJsonData = DataSourceJsonData> {
  options: DataSourceOptionsType<T>;
  onOptionsChange: (options: DataSourceOptionsType<T>) => void;
}

export interface HttpSettingsProps<T extends DataSourceJsonData = DataSourceJsonData> {
  options: DataSourceOptionsType<T>;
  onOptionsChange: (options: DataSourceOptionsType<T>) => void;
}
