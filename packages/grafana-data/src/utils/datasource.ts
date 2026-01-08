import { isString } from 'lodash';

import { DataSourceRef } from '@grafana/schema';

import { KeyValue } from '../types/data';
import {
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
} from '../types/datasource';
import { SelectableValue } from '../types/select';

/**
 * Convert instance settings to a reference
 *
 * @public
 */
export function getDataSourceRef(ds: DataSourceInstanceSettings): DataSourceRef {
  const ref: DataSourceRef = { uid: ds.uid, type: ds.type };
  if (ds.apiVersion) {
    ref.apiVersion = ds.apiVersion;
  }
  return ref;
}

/**
 * Returns true if the argument is a DataSourceRef
 *
 * @public
 */
export function isDataSourceRef(ref: unknown): ref is DataSourceRef {
  if (typeof ref !== 'object' || ref === null) {
    return false;
  }

  const hasUid = 'uid' in ref && typeof ref.uid === 'string';
  const hasType = 'type' in ref && typeof ref.type === 'string';
  return hasUid || hasType;
}

/**
 * Get the UID from a string of reference
 *
 * @public
 */
export function getDataSourceUID(ref: DataSourceRef | string | null): string | undefined {
  if (isDataSourceRef(ref)) {
    return ref.uid;
  }
  if (isString(ref)) {
    return ref;
  }
  return undefined;
}

export const onUpdateDatasourceOption =
  (props: DataSourcePluginOptionsEditorProps, key: keyof DataSourceSettings) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateDatasourcePluginOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceJsonDataOption =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceSecureJsonDataOption =
  <J extends DataSourceJsonData, S extends {} = KeyValue>(
    props: DataSourcePluginOptionsEditorProps<J, S>,
    key: string
  ) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    updateDatasourcePluginSecureJsonDataOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceJsonDataOptionSelect =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (selected: SelectableValue) => {
    updateDatasourcePluginJsonDataOption(props, key, selected.value);
  };

export const onUpdateDatasourceJsonDataOptionChecked =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (event: React.SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.checked);
  };

export const onUpdateDatasourceSecureJsonDataOptionSelect =
  <J extends DataSourceJsonData, S extends {} = KeyValue>(
    props: DataSourcePluginOptionsEditorProps<J, S>,
    key: string
  ) =>
  (selected: SelectableValue) => {
    updateDatasourcePluginSecureJsonDataOption(props, key, selected.value);
  };

export const onUpdateDatasourceResetOption =
  (props: DataSourcePluginOptionsEditorProps, key: string) =>
  (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    updateDatasourcePluginResetOption(props, key);
  };

export function updateDatasourcePluginOption<J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: keyof DataSourceSettings,
  val: unknown
) {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    [key]: val,
  });
}

export const updateDatasourcePluginJsonDataOption = <J extends DataSourceJsonData, S, K extends keyof J>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: K,
  val: unknown
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

export const updateDatasourcePluginSecureJsonDataOption = <J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string,
  val: unknown
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...(config.secureJsonData ? config.secureJsonData : ({} as S)),
      [key]: val,
    },
  });
};

export const updateDatasourcePluginResetOption = <J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string
) => {
  const config = props.options;
  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...(config.secureJsonData ? config.secureJsonData : ({} as S)),
      [key]: '',
    },
    secureJsonFields: {
      ...config.secureJsonFields,
      [key]: false,
    },
  });
};
