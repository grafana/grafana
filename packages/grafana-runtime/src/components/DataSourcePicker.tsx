// Libraries
import { useEffect, useMemo, useState } from 'react';

// Components
import { DataSourceInstanceSettings, DataSourceRef, getDataSourceUID, isUnsignedPluginSignature } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { getDataSourceSrv } from '../services/dataSourceSrv';

import { ExpressionDatasourceRef } from './../utils/DataSourceWithBackend';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange?: (ds: DataSourceInstanceSettings) => void;
  current?: DataSourceRef | string | null; // uid
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  // If set to true and there is no value select will be empty, otherwise it will preselect default data source
  noDefault?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Component state description for the {@link DataSourcePicker}
 *
 * @deprecated. Not the real implementation used by core, left here for backwards compatibility.
 * @internal
 */
export interface DataSourcePickerState {
  error?: string;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
export function DataSourcePicker(props: DataSourcePickerProps) {
  const {
    current = null,
    onChange = () => {},
    onBlur,
    onClear,
    autoFocus = false,
    placeholder = 'Select data source',
    width,
    inputId,
    disabled = false,
    isLoading = false,
    alerting,
    tracing,
    metrics,
    mixed,
    dashboard,
    variables,
    annotations,
    pluginId,
    type,
    filter,
    logs,
    noDefault,
    invalid,
  } = props;

  const [error, setError] = useState<string | undefined>();
  const dataSourceSrv = getDataSourceSrv();

  useEffect(() => {
    const dsSettings = dataSourceSrv.getInstanceSettings(current);
    if (!dsSettings) {
      setError('Could not find data source ' + current);
    } else {
      setError(undefined);
    }
  }, [current, dataSourceSrv]);

  const handleChange = (item: ComboboxOption<string> | null) => {
    if (item === null && onClear) {
      onClear();
      return;
    }

    if (item) {
      const dsSettings = dataSourceSrv.getInstanceSettings(item.value);

      if (dsSettings) {
        onChange(dsSettings);
        setError(undefined);
      }
    }
  };

  const getCurrentValue = (): ComboboxOption<string> | undefined => {
    if (!current && noDefault) {
      return;
    }

    const ds = dataSourceSrv.getInstanceSettings(current);

    if (ds) {
      return {
        label: ds.name.slice(0, 37),
        value: ds.uid,
      };
    }

    const uid = getDataSourceUID(current);

    if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
      return { label: uid, value: uid };
    }

    return {
      label: (uid ?? 'no name') + ' - not found',
      value: uid ?? '',
    };
  };

  const value = getCurrentValue();

  const options = useMemo((): Array<ComboboxOption<string>> => {
    return dataSourceSrv
      .getList({
        alerting,
        tracing,
        metrics,
        logs,
        dashboard,
        mixed,
        variables,
        annotations,
        pluginId,
        filter,
        type,
      })
      .map((ds) => {
        const baseLabel = `${ds.name}${ds.isDefault ? ' (default)' : ''}`;
        // Check for unsigned plugins for UI indication
        const isCurrentlySelected = value?.value === ds.name;
        const hasUnsignedSignature = ds.meta && isUnsignedPluginSignature(ds.meta.signature);

        const label = hasUnsignedSignature && !isCurrentlySelected ? `${baseLabel} (unsigned plugin)` : baseLabel;

        return {
          value: ds.name,
          label,
        };
      });
  }, [
    alerting,
    tracing,
    metrics,
    logs,
    dashboard,
    mixed,
    variables,
    annotations,
    pluginId,
    filter,
    type,
    dataSourceSrv,
    value,
  ]);

  const isClearable = typeof onClear === 'function';

  return (
    <div aria-label="Data source picker select container" data-testid={selectors.components.DataSourcePicker.container}>
      <Combobox
        loading={isLoading}
        disabled={disabled}
        aria-labelledby={'Select a data source'}
        data-testid={selectors.components.DataSourcePicker.inputV2}
        id={inputId || 'data-source-picker'}
        isClearable={isClearable}
        onChange={handleChange}
        options={options}
        autoFocus={autoFocus}
        onBlur={onBlur}
        width={width}
        placeholder={placeholder}
        value={value ?? null}
        invalid={Boolean(error) || Boolean(invalid)}
      />
    </div>
  );
}
