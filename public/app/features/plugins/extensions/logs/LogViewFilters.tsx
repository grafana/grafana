import { isEmpty } from 'lodash';
import { ReactElement, useMemo } from 'react';

import { DataFrame, MatcherConfig, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneDataProvider } from '@grafana/scenes';
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui';

export type LogFilter = {
  pluginIds?: Set<string>;
  extensionPointIds?: Set<string>;
  severity?: Set<string>;
  initial?: string;
};

type LogViewFiltersProps = {
  provider: SceneDataProvider;
  filteredProvider: SceneDataProvider;
  filter: LogFilter;
  onChange: (filter: LogFilter) => void;
};

export function LogViewFilters({ provider, filteredProvider, filter, onChange }: LogViewFiltersProps): ReactElement {
  const { pluginIds, extensionPointIds, severity } = useLogFilters(provider, filteredProvider, filter);

  const onChangePluginIds = (values: Array<SelectableValue<string>>) => {
    const update = {
      ...filter,
      pluginIds: mapToSet(values),
    };

    if (isEmpty(filter.extensionPointIds) && isEmpty(filter.severity)) {
      update.initial = isEmpty(values) ? undefined : 'pluginId';
    }

    onChange(update);
  };

  const onChangeExtensionPointIds = (values: Array<SelectableValue<string>>) => {
    const update = {
      ...filter,
      extensionPointIds: mapToSet(values),
    };

    if (isEmpty(filter.pluginIds) && isEmpty(filter.severity)) {
      update.initial = isEmpty(values) ? undefined : 'extensionPointId';
    }

    onChange(update);
  };

  const onChangeSeverity = (values: Array<SelectableValue<string>>) => {
    const update = {
      ...filter,
      severity: mapToSet(values),
    };

    if (isEmpty(filter.pluginIds) && isEmpty(filter.extensionPointIds)) {
      update.initial = isEmpty(values) ? undefined : 'severity';
    }

    onChange(update);
  };

  return (
    <InlineFieldRow>
      <InlineField label={t('plugins.log-view-filters.label-plugin-id', 'Plugin Id')}>
        <MultiSelect options={pluginIds} onChange={onChangePluginIds} />
      </InlineField>
      <InlineField label={t('plugins.log-view-filters.label-extension', 'Extension')}>
        <MultiSelect options={extensionPointIds} onChange={onChangeExtensionPointIds} />
      </InlineField>
      <InlineField label={t('plugins.log-view-filters.label-severity', 'Severity')}>
        <MultiSelect options={severity} onChange={onChangeSeverity} />
      </InlineField>
    </InlineFieldRow>
  );
}

export type FilterConfig = {
  fieldName: string;
  config: MatcherConfig;
};

type LogFilterOptions = {
  pluginIds: Array<SelectableValue<string>>;
  extensionPointIds: Array<SelectableValue<string>>;
  severity: Array<SelectableValue<string>>;
};

function useLogFilters(
  provider: SceneDataProvider,
  filteredProvider: SceneDataProvider,
  filter: LogFilter
): LogFilterOptions {
  const { data } = provider.useState();
  const { data: filteredData } = filteredProvider.useState();

  return useMemo(() => {
    if (data && data?.series.length > 1) {
      console.warn('LogViewFilter does not support multiple series in query result.');
    }

    const frame = data?.series[0];
    const filteredFrame = filteredData?.series[0];

    if (!frame) {
      return {
        pluginIds: [],
        extensionPointIds: [],
        severity: [],
      };
    }

    if (!filteredFrame) {
      return toFilterOptions({
        severity: frame,
        pluginId: frame,
        extensionPointId: frame,
      });
    }

    switch (filter.initial) {
      case 'extensionPointId':
        return toFilterOptions({
          severity: filteredFrame,
          pluginId: filteredFrame,
          extensionPointId: frame,
        });

      case 'severity':
        return toFilterOptions({
          severity: frame,
          pluginId: filteredFrame,
          extensionPointId: filteredFrame,
        });

      case 'pluginId':
        return toFilterOptions({
          severity: filteredFrame,
          pluginId: frame,
          extensionPointId: filteredFrame,
        });

      default:
        return toFilterOptions({
          severity: frame,
          pluginId: frame,
          extensionPointId: frame,
        });
    }
  }, [data, filteredData, filter]);
}

function mapToSet(selected: Array<SelectableValue<string>>): Set<string> | undefined {
  if (selected.length <= 0) {
    return undefined;
  }

  return selected.reduce((set, selectable) => {
    if (selectable.value) {
      set.add(selectable.value);
    }
    return set;
  }, new Set<string>());
}

function toSelectableArray(source: Set<string>): Array<SelectableValue<string>> {
  return Array.from(source).reduce((all: Array<SelectableValue<string>>, current) => {
    if (!current) {
      return all;
    }
    all.push({
      value: current,
      label: current,
    });
    return all;
  }, []);
}

function toFilterOptions(sources: {
  severity: DataFrame;
  pluginId: DataFrame;
  extensionPointId: DataFrame;
}): LogFilterOptions {
  const { severity, pluginId, extensionPointId } = sources;
  const severityIndex = severity.fields.findIndex((f) => f.name === 'severity');
  const pluginIdIndex = pluginId.fields.findIndex((f) => f.name === 'pluginId');
  const extensionPointIdIndex = extensionPointId.fields.findIndex((f) => f.name === 'extensionPointId');

  const severities = new Set<string>(severity.fields[severityIndex].values);
  const pluginIds = new Set<string>(pluginId.fields[pluginIdIndex].values);
  const extensionPointIds = new Set<string>(extensionPointId.fields[extensionPointIdIndex].values);

  return {
    severity: toSelectableArray(severities),
    pluginIds: toSelectableArray(pluginIds),
    extensionPointIds: toSelectableArray(extensionPointIds),
  };
}
