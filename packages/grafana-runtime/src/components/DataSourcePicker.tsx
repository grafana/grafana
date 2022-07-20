// Libraries
import React, { useEffect, useState } from 'react';

// Components
import {
  DataSourceInstanceSettings,
  DataSourceRef,
  getDataSourceUID,
  isUnsignedPluginSignature,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ActionMeta, HorizontalGroup, PluginSignatureBadge, Select } from '@grafana/ui';

import { getDataSourceSrv } from '../services/dataSourceSrv';

import { ExpressionDatasourceRef } from './../utils/DataSourceWithBackend';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | undefined | null; // uid
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
  repeatVariableName?: string;
}

/**
 * Component state description for the {@link DataSourcePicker}
 *
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
export const DataSourcePicker = React.memo(
  ({
    autoFocus = false,
    openMenuOnFocus = false,
    placeholder = 'Select data source',
    alerting,
    annotations,
    current,
    dashboard,
    filter,
    hideTextValue,
    inputId,
    logs,
    metrics,
    mixed,
    noDefault,
    onBlur,
    onChange,
    onClear,
    pluginId,
    repeatVariableName,
    tracing,
    type,
    variables,
    width,
  }: DataSourcePickerProps) => {
    const dataSourceSrv = getDataSourceSrv();
    const [error, setError] = useState<string | undefined>(undefined);

    useEffect(() => {
      const dsSettings = dataSourceSrv.getInstanceSettings(current);
      if (!dsSettings) {
        setError(`Could not find data source ${current}`);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onValueChange = (item: SelectableValue<string>, actionMeta: ActionMeta) => {
      if (actionMeta.action === 'clear' && onClear) {
        onClear();
        return;
      }

      const dsSettings = dataSourceSrv.getInstanceSettings(item.value);

      if (dsSettings) {
        onChange(dsSettings);
        setError(undefined);
      }
    };

    const selectOptions = (() => {
      const options = dataSourceSrv
        .getList(
          {
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
          },
          repeatVariableName
        )
        .map((ds) => ({
          value: ds.name,
          label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
          imgUrl: ds.meta.info.logos.small,
          meta: ds.meta,
        }));

      return options;
    })();

    const currentOption = (() => {
      if (!current && noDefault) {
        return null;
      }

      let currentName = typeof current === 'string' ? current : current?.uid ?? '';
      const isDatasourceVariable = currentName.startsWith('$');
      const isValidOption = selectOptions.some((o) => o.value === currentName);
      if (isDatasourceVariable && !isValidOption) {
        // datasource variable is no longer a valid option, set to default
        const defaults = dataSourceSrv.getInstanceSettings();
        if (defaults && !noDefault) {
          onChange(defaults);
        }

        return null;
      }

      const ds = dataSourceSrv.getInstanceSettings(current);

      if (ds) {
        return {
          label: ds.name.slice(0, 37),
          value: ds.uid,
          imgUrl: ds.meta.info.logos.small,
          hideText: hideTextValue,
          meta: ds.meta,
        };
      }

      const uid = getDataSourceUID(current ?? null);

      if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
        return { label: uid, value: uid, hideText: hideTextValue };
      }

      return {
        label: `${uid ?? 'no name'} - not found`,
        value: uid ?? undefined,
        imgUrl: '',
        hideText: hideTextValue,
      };
    })();

    const isClearable = typeof onClear === 'function';

    return (
      <div aria-label={selectors.components.DataSourcePicker.container}>
        <Select
          aria-label={selectors.components.DataSourcePicker.inputV2}
          inputId={inputId || 'data-source-picker'}
          className="ds-picker select-container"
          isMulti={false}
          isClearable={isClearable}
          backspaceRemovesValue={false}
          onChange={onValueChange}
          options={selectOptions}
          autoFocus={autoFocus}
          onBlur={onBlur}
          width={width}
          openMenuOnFocus={openMenuOnFocus}
          maxMenuHeight={500}
          placeholder={placeholder}
          noOptionsMessage="No datasources found"
          value={currentOption}
          invalid={!!error}
          getOptionLabel={(o) => {
            if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== currentOption) {
              return (
                <HorizontalGroup align="center" justify="space-between">
                  <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
                </HorizontalGroup>
              );
            }
            return o.label || '';
          }}
        />
      </div>
    );
  }
);

DataSourcePicker.displayName = 'DataSourcePicker';
