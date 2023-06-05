import React, { useState } from 'react';
import { PopValueActionMeta, RemoveValueActionMeta } from 'react-select';

import {
  DataSourceInstanceSettings,
  getDataSourceUID,
  isUnsignedPluginSignature,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv, DataSourcePickerState, DataSourcePickerProps } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { ActionMeta, HorizontalGroup, PluginSignatureBadge, MultiSelect } from '@grafana/ui';

export interface MultipleDataSourcePickerProps extends Omit<DataSourcePickerProps, 'onChange' | 'current'> {
  onChange: (ds: DataSourceInstanceSettings, action: 'add' | 'remove') => void;
  current: string[] | undefined;
}

export const MultipleDataSourcePicker = (props: MultipleDataSourcePickerProps) => {
  const dataSourceSrv = getDataSourceSrv();

  const [state, setState] = useState<DataSourcePickerState>();

  const onChange = (items: Array<SelectableValue<string>>, actionMeta: ActionMeta) => {
    if (actionMeta.action === 'clear' && props.onClear) {
      props.onClear();
      return;
    }

    const selectedItem = items[items.length - 1];

    let dataSourceName, action: 'add' | 'remove';

    if (actionMeta.action === 'pop-value' || actionMeta.action === 'remove-value') {
      const castedActionMeta:
        | RemoveValueActionMeta<SelectableValue<string>>
        | PopValueActionMeta<SelectableValue<string>> = actionMeta;
      dataSourceName = castedActionMeta.removedValue?.value;
      action = 'remove';
    } else {
      dataSourceName = selectedItem.value;
      action = 'add';
    }

    const dsSettings = dataSourceSrv.getInstanceSettings(dataSourceName);

    if (dsSettings) {
      props.onChange(dsSettings, action);
      setState({ error: undefined });
    }
  };

  const getCurrentValue = (): Array<SelectableValue<string>> | undefined => {
    const { current, hideTextValue, noDefault } = props;
    if (!current && noDefault) {
      return;
    }

    return current?.map((dataSourceName: string) => {
      const ds = dataSourceSrv.getInstanceSettings(dataSourceName);
      if (ds) {
        return {
          label: ds.name.slice(0, 37),
          value: ds.name,
          imgUrl: ds.meta.info.logos.small,
          hideText: hideTextValue,
          meta: ds.meta,
        };
      }

      const uid = getDataSourceUID(dataSourceName);

      if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
        return { label: uid, value: uid, hideText: hideTextValue };
      }

      return {
        label: (uid ?? 'no name') + ' - not found',
        value: uid ?? undefined,
        imgUrl: '',
        hideText: hideTextValue,
      };
    });
  };

  const getDataSourceOptions = () => {
    const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } =
      props;

    const dataSources = dataSourceSrv.getList({
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
    });

    const alertManagingDs = dataSources
      .filter((ds) => ds.jsonData.manageAlerts)
      .map((ds) => ({
        value: ds.name,
        label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      }));

    const nonAlertManagingDs = dataSources
      .filter((ds) => !ds.jsonData.manageAlerts)
      .map((ds) => ({
        value: ds.name,
        label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      }));

    const groupedOptions = [
      { label: 'Data sources with configured alert rules', options: alertManagingDs, expanded: true },
      { label: 'Other data sources', options: nonAlertManagingDs, expanded: true },
    ];

    return groupedOptions;
  };

  const {
    autoFocus,
    onBlur,
    onClear,
    openMenuOnFocus,
    placeholder,
    width,
    inputId,
    disabled = false,
    isLoading = false,
  } = props;

  const options = getDataSourceOptions();
  const value = getCurrentValue();
  const isClearable = typeof onClear === 'function';

  return (
    <div data-testid={selectors.components.DataSourcePicker.container}>
      <MultiSelect
        isLoading={isLoading}
        disabled={disabled}
        data-testid={selectors.components.DataSourcePicker.inputV2}
        inputId={inputId || 'data-source-picker'}
        className="ds-picker select-container"
        isClearable={isClearable}
        backspaceRemovesValue={true}
        onChange={onChange}
        options={options}
        autoFocus={autoFocus}
        onBlur={onBlur}
        width={width}
        openMenuOnFocus={openMenuOnFocus}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage="No datasources found"
        value={value ?? []}
        invalid={Boolean(state?.error) || Boolean(props.invalid)}
        getOptionLabel={(o) => {
          if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
            return (
              <HorizontalGroup align="center" justify="space-between" height="auto">
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
