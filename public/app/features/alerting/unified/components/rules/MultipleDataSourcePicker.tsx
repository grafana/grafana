import { useMemo, useState } from 'react';
import { type PopValueActionMeta, type RemoveValueActionMeta } from 'react-select';
import { useAsync } from 'react-use';

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type SelectableValue,
  getDataSourceUID,
  isUnsignedPluginSignature,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type DataSourcePickerProps } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type ActionMeta, MultiSelect, PluginSignatureBadge, Stack } from '@grafana/ui';

import { useDataSourceInstanceListByUid } from '../../hooks/useDataSourceInstanceListByUid';
import { isDataSourceManagingAlerts } from '../../utils/datasource';

export interface MultipleDataSourcePickerProps extends Omit<DataSourcePickerProps, 'onChange' | 'current'> {
  onChange: (ds: DataSourceInstanceSettings, action: 'add' | 'remove') => void;
  current: string[] | undefined;
}

export const MultipleDataSourcePicker = (props: MultipleDataSourcePickerProps) => {
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
    current,
    hideTextValue,
    noDefault,
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
  } = props;

  const [state, setState] = useState<{ error?: string }>();

  // `isDataSourceManagingAlerts` and `filter` need `jsonData`, absent from the slim list item.
  const { value: dataSources = [] } = useAsync(async () => {
    const items = await getDataSourceInstanceList({
      alerting,
      tracing,
      metrics,
      logs,
      dashboard,
      mixed,
      variables,
      annotations,
      pluginId,
      type,
    });
    const settled = await Promise.all(items.map((item) => getDataSourceInstanceSettings(item.uid)));
    const settledSettings = settled.filter((ds): ds is DataSourceInstanceSettings => !!ds);
    return filter ? settledSettings.filter(filter) : settledSettings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerting, tracing, metrics, logs, dashboard, mixed, variables, annotations, pluginId, filter, type]);

  // Unrestricted by the type filters above, since `current` may reference a data source they'd exclude.
  const dataSourceByUid = useDataSourceInstanceListByUid();
  const dataSourceByName = useMemo(() => {
    const map = new Map<string, DataSourceInstanceListItem>();
    dataSourceByUid.forEach((ds) => map.set(ds.name, ds));
    return map;
  }, [dataSourceByUid]);

  const onChange = async (items: Array<SelectableValue<string>>, actionMeta: ActionMeta) => {
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

    const dsSettings = await getDataSourceInstanceSettings(dataSourceName);
    if (dsSettings) {
      props.onChange(dsSettings, action);
      setState({ error: undefined });
    }
  };

  const getCurrentValue = (): Array<SelectableValue<string>> | undefined => {
    if (!current && noDefault) {
      return;
    }

    return current?.map((dataSourceName: string) => {
      const ds = dataSourceByUid.get(dataSourceName) ?? dataSourceByName.get(dataSourceName);
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
    const alertManagingDs = dataSources.filter(isDataSourceManagingAlerts).map((ds) => ({
      value: ds.name,
      label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
    }));

    const nonAlertManagingDs = dataSources
      .filter((ds) => !isDataSourceManagingAlerts(ds))
      .map((ds) => ({
        value: ds.name,
        label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      }));

    const groupedOptions = [
      {
        label: t(
          'alerting.multiple-data-source-picker.get-data-source-options.grouped-options.label.data-sources-with-configured-alert-rules',
          'Data sources with configured alert rules'
        ),
        options: alertManagingDs,
        expanded: true,
      },
      {
        label: t(
          'alerting.multiple-data-source-picker.get-data-source-options.grouped-options.label.other-data-sources',
          'Other data sources'
        ),
        options: nonAlertManagingDs,
        expanded: true,
      },
    ];

    return groupedOptions;
  };

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
        noOptionsMessage={t(
          'alerting.multiple-data-source-picker.noOptionsMessage-no-datasources-found',
          'No datasources found'
        )}
        value={value ?? []}
        invalid={Boolean(state?.error) || Boolean(props.invalid)}
        getOptionLabel={(o) => {
          if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
            return (
              <Stack alignItems="center" justifyContent="space-between">
                <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
              </Stack>
            );
          }
          return o.label || '';
        }}
      />
    </div>
  );
};
