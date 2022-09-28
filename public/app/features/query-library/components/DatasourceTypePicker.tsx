// Libraries
import { uniqBy } from 'lodash';
import React from 'react';

// Components
import { DataSourceInstanceSettings, isUnsignedPluginSignature } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime/src';
import { HorizontalGroup, PluginSignatureBadge, Select } from '@grafana/ui';

export type DatasourceTypePickerProps = {
  onChange: (ds: string | null) => void;
  current: string | null; // type
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
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
};

const getDataSourceTypeOptions = (props: DatasourceTypePickerProps) => {
  const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } = props;

  return uniqBy(
    getDataSourceSrv()
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
        if (ds.type === 'datasource') {
          return {
            value: ds.type,
            label: ds.type,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
          };
        }

        return {
          value: ds.type,
          label: ds.type,
          imgUrl: ds.meta.info.logos.small,
          meta: ds.meta,
        };
      }),
    (opt) => opt.value
  );
};

export const DatasourceTypePicker = (props: DatasourceTypePickerProps) => {
  const { autoFocus, onBlur, onChange, current, openMenuOnFocus, placeholder, width, inputId } = props;
  const options = getDataSourceTypeOptions(props);

  return (
    <div aria-label={selectors.components.DataSourcePicker.container}>
      <Select
        aria-label={selectors.components.DataSourcePicker.inputV2}
        inputId={inputId || 'data-source-picker'}
        className="ds-picker select-container"
        isMulti={false}
        isClearable={true}
        backspaceRemovesValue={true}
        options={options}
        autoFocus={autoFocus}
        onBlur={onBlur}
        width={width}
        value={current}
        onChange={(newValue) => {
          onChange(newValue?.value ?? null);
        }}
        openMenuOnFocus={openMenuOnFocus}
        maxMenuHeight={500}
        placeholder={placeholder ?? 'Select datasource type'}
        noOptionsMessage="No datasources found"
        getOptionLabel={(o) => {
          if (o.meta && isUnsignedPluginSignature(o.meta.signature)) {
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
};
