import { DataSourcePluginOptionsEditorProps, SelectableValue, KeyValue, DataSourceSettings } from '../types';

export const onUpdateDatasourceOption = (props: DataSourcePluginOptionsEditorProps, key: keyof DataSourceSettings) => (
  event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
) => {
  updateDatasourcePluginOption(props, key, event.currentTarget.value);
};

export const onUpdateDatasourceJsonDataOption = <J, S, K extends keyof J>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: K
) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
  updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.value);
};

export const onUpdateDatasourceSecureJsonDataOption = <J, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string
) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
  updateDatasourcePluginSecureJsonDataOption(props, key, event.currentTarget.value);
};

export const onUpdateDatasourceJsonDataOptionSelect = <J, S, K extends keyof J>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: K
) => (selected: SelectableValue) => {
  updateDatasourcePluginJsonDataOption(props, key, selected.value);
};

export const onUpdateDatasourceSecureJsonDataOptionSelect = <J, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string
) => (selected: SelectableValue) => {
  updateDatasourcePluginSecureJsonDataOption(props, key, selected.value);
};

export const onUpdateDatasourceResetOption = (props: DataSourcePluginOptionsEditorProps, key: string) => (
  event: React.MouseEvent<HTMLButtonElement, MouseEvent>
) => {
  updateDatasourcePluginResetOption(props, key);
};

export function updateDatasourcePluginOption(
  props: DataSourcePluginOptionsEditorProps,
  key: keyof DataSourceSettings,
  val: any
) {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    [key]: val,
  });
}

export const updateDatasourcePluginJsonDataOption = <J, S, K extends keyof J>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: K,
  val: any
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    jsonData: {
      ...config.jsonData,
      [key]: val,
    },
  });
};

export const updateDatasourcePluginSecureJsonDataOption = <J, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string,
  val: any
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...config.secureJsonData!,
      [key]: val,
    },
  });
};

export const updateDatasourcePluginResetOption = <J, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps,
  key: string
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...config.secureJsonData,
      [key]: '',
    },
    secureJsonFields: {
      ...config.secureJsonFields,
      [key]: false,
    },
  });
};
