import { useMemo } from 'react';
import { type PopValueActionMeta, type RemoveValueActionMeta } from 'react-select';

import { useDataSourcesManagingAlertsByUid } from '@grafana/alerting/internal';
import {
  type DataSourceInstanceListItem,
  type SelectableValue,
  getDataSourceUID,
  isUnsignedPluginSignature,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceList, useDefaultDataSourceInstanceListItem } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type ActionMeta, MultiSelect, PluginSignatureBadge, Stack } from '@grafana/ui';

export interface MultipleDataSourcePickerProps {
  /** Only offer data sources whose plugin supports alerting. */
  alerting?: boolean;
  noDefault?: boolean;
  placeholder?: string;
  current: string[] | undefined;
  onChange: (ds: DataSourceInstanceListItem, action: 'add' | 'remove') => void;
  onClear?: () => void;
}

export const MultipleDataSourcePicker = (props: MultipleDataSourcePickerProps) => {
  const { alerting, noDefault, placeholder, current, onClear } = props;

  const { items: dataSources, isLoading: isLoadingOptions } = useDataSourceInstanceList({ alerting });
  const { byUid: managingAlertsByUid, isLoading: isLoadingManagingAlerts } = useDataSourcesManagingAlertsByUid();

  // `current` comes from the URL and may name a data source that the options exclude, so resolve it
  // against every data source, by uid or by name.
  const { items: allDataSources, isLoading: isLoadingAllDataSources } = useDataSourceInstanceList({ all: true });
  const { item: defaultDataSource } = useDefaultDataSourceInstanceListItem(allDataSources);
  const resolveDataSource = useMemo(() => {
    const byUid = new Map(allDataSources.map((ds) => [ds.uid, ds]));
    const byName = new Map(allDataSources.map((ds) => [ds.name, ds]));
    return (uidOrName: string) => byUid.get(uidOrName) ?? byName.get(uidOrName);
  }, [allDataSources]);

  const onChange = (items: Array<SelectableValue<string>>, actionMeta: ActionMeta) => {
    if (actionMeta.action === 'clear' && onClear) {
      onClear();
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

    const ds = dataSourceName ? resolveDataSource(dataSourceName) : undefined;

    if (ds) {
      props.onChange(ds, action);
    }
  };

  const getCurrentValue = (): Array<SelectableValue<string>> | undefined => {
    if (!current && noDefault) {
      return;
    }

    return current?.map((dataSourceName: string) => {
      // Show the stored name until the list resolves, rather than flashing "not found".
      if (isLoadingAllDataSources) {
        return { label: dataSourceName, value: dataSourceName };
      }

      const ds = resolveDataSource(dataSourceName);
      if (ds) {
        return {
          label: ds.name.slice(0, 37),
          value: ds.name,
          imgUrl: ds.meta.info.logos.small,
          meta: ds.meta,
        };
      }

      const uid = getDataSourceUID(dataSourceName);

      if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
        return { label: uid, value: uid };
      }

      return {
        label: (uid ?? 'no name') + ' - not found',
        value: uid ?? undefined,
        imgUrl: '',
      };
    });
  };

  const getDataSourceOptions = () => {
    const toOption = (ds: DataSourceInstanceListItem) => ({
      value: ds.name,
      label: `${ds.name}${ds.uid === defaultDataSource?.uid ? ' (default)' : ''}`,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
    });

    const alertManagingDs = dataSources.filter((ds) => managingAlertsByUid.has(ds.uid)).map(toOption);
    const nonAlertManagingDs = dataSources.filter((ds) => !managingAlertsByUid.has(ds.uid)).map(toOption);

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
        isLoading={isLoadingOptions || isLoadingManagingAlerts || isLoadingAllDataSources}
        data-testid={selectors.components.DataSourcePicker.inputV2}
        inputId="data-source-picker"
        className="ds-picker select-container"
        isClearable={isClearable}
        backspaceRemovesValue={true}
        onChange={onChange}
        options={options}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage={t(
          'alerting.multiple-data-source-picker.noOptionsMessage-no-datasources-found',
          'No datasources found'
        )}
        value={value ?? []}
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
