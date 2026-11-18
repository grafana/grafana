import { useMemo } from 'react';

import { useDataSourcesManagingAlertsByUid } from '@grafana/alerting/internal';
import { type DataSourceInstanceListItem, type SelectableValue, isUnsignedPluginSignature } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceList, useDefaultDataSourceInstanceListItem } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type ActionMeta, MultiSelect, PluginSignatureBadge, Stack } from '@grafana/ui';

export interface MultipleDataSourcePickerProps {
  /** Only offer data sources whose plugin supports alerting. */
  alerting?: boolean;
  placeholder?: string;
  /** Data source names, as stored in the URL. */
  current: string[] | undefined;
  onChange: (ds: DataSourceInstanceListItem, action: 'add' | 'remove') => void;
  onClear?: () => void;
}

/** An option or selected value. Only those that resolve to a data source carry it. */
type DataSourceOption = SelectableValue<string> & { dataSource?: DataSourceInstanceListItem };

export function MultipleDataSourcePicker({
  alerting,
  placeholder,
  current = [],
  onChange,
  onClear,
}: MultipleDataSourcePickerProps) {
  const { isLoading, options, value } = useDataSourcePickerOptions({ alerting, current });

  const handleChange = (_: Array<SelectableValue<string>>, actionMeta: ActionMeta) => {
    if (actionMeta.action === 'clear') {
      onClear?.();
      return;
    }

    const isRemoval = actionMeta.action === 'remove-value' || actionMeta.action === 'pop-value';
    const changed: DataSourceOption | undefined = isRemoval ? actionMeta.removedValue : actionMeta.option;

    if (changed?.dataSource) {
      onChange(changed.dataSource, isRemoval ? 'remove' : 'add');
    }
  };

  return (
    <div data-testid={selectors.components.DataSourcePicker.container}>
      <MultiSelect<string>
        isLoading={isLoading}
        data-testid={selectors.components.DataSourcePicker.inputV2}
        inputId="data-source-picker"
        className="ds-picker select-container"
        isClearable={Boolean(onClear)}
        backspaceRemovesValue={true}
        onChange={handleChange}
        options={options}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage={t(
          'alerting.multiple-data-source-picker.noOptionsMessage-no-datasources-found',
          'No datasources found'
        )}
        value={value}
        getOptionLabel={renderOptionLabel}
      />
    </div>
  );
}

interface DataSourceLookup {
  byUid: Map<string, DataSourceInstanceListItem>;
  byName: Map<string, DataSourceInstanceListItem>;
}

function useDataSourcePickerOptions({ alerting, current }: { alerting?: boolean; current: string[] }) {
  const optionsList = useDataSourceInstanceList({ alerting });
  const managingAlerts = useDataSourcesManagingAlertsByUid();
  // `current` may name a data source that the options exclude, so resolve it against every data source.
  const allDataSourcesList = useDataSourceInstanceList({ all: true });
  const { item: defaultDataSource } = useDefaultDataSourceInstanceListItem(allDataSourcesList.items);

  const lookup = useMemo<DataSourceLookup>(
    () => ({
      byUid: new Map(allDataSourcesList.items.map((ds) => [ds.uid, ds])),
      byName: new Map(allDataSourcesList.items.map((ds) => [ds.name, ds])),
    }),
    [allDataSourcesList.items]
  );

  return {
    isLoading: optionsList.isLoading || managingAlerts.isLoading || allDataSourcesList.isLoading,
    options: groupOptions(optionsList.items, managingAlerts.byUid, defaultDataSource?.uid),
    value: current.map((ref) => toSelectedValue(ref, lookup, allDataSourcesList.isLoading)),
  };
}

// MultiSelect replaces a selected value with the option that has the same `value`, and hides that
// option from the menu. Options and resolved values must therefore both use the uid.
function toSelectedValue(ref: string, lookup: DataSourceLookup, isLoading: boolean): DataSourceOption {
  if (isLoading) {
    return { label: ref, value: ref };
  }

  const ds = lookup.byUid.get(ref) ?? lookup.byName.get(ref);
  if (ds) {
    return {
      label: ds.name.slice(0, 37),
      value: ds.uid,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
      dataSource: ds,
    };
  }

  if (ref === ExpressionDatasourceRef.uid || ref === ExpressionDatasourceRef.name) {
    return { label: ref, value: ref };
  }

  return { label: `${ref} - not found`, value: ref, imgUrl: '' };
}

function toOption(ds: DataSourceInstanceListItem, defaultUid: string | undefined): DataSourceOption {
  return {
    label: `${ds.name}${ds.uid === defaultUid ? ' (default)' : ''}`,
    value: ds.uid,
    imgUrl: ds.meta.info.logos.small,
    meta: ds.meta,
    dataSource: ds,
  };
}

function groupOptions(
  dataSources: DataSourceInstanceListItem[],
  managingAlertsByUid: Map<string, DataSourceInstanceListItem>,
  defaultUid: string | undefined
) {
  const managing = dataSources.filter((ds) => managingAlertsByUid.has(ds.uid));
  const others = dataSources.filter((ds) => !managingAlertsByUid.has(ds.uid));

  return [
    {
      label: t(
        'alerting.multiple-data-source-picker.get-data-source-options.grouped-options.label.data-sources-with-configured-alert-rules',
        'Data sources with configured alert rules'
      ),
      options: managing.map((ds) => toOption(ds, defaultUid)),
      expanded: true,
    },
    {
      label: t(
        'alerting.multiple-data-source-picker.get-data-source-options.grouped-options.label.other-data-sources',
        'Other data sources'
      ),
      options: others.map((ds) => toOption(ds, defaultUid)),
      expanded: true,
    },
  ];
}

function renderOptionLabel(option: SelectableValue<string>) {
  if (option.meta && isUnsignedPluginSignature(option.meta.signature)) {
    return (
      <Stack alignItems="center" justifyContent="space-between">
        <span>{option.label}</span> <PluginSignatureBadge status={option.meta.signature} />
      </Stack>
    );
  }
  return option.label || '';
}
