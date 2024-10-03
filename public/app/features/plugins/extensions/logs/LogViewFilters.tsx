import { isEmpty } from 'lodash';
import { ReactElement, useMemo } from 'react';

import { DataFrame, MatcherConfig, SelectableValue } from '@grafana/data';
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
    if (isEmpty(filter.extensionPointIds) && isEmpty(filter.severity)) {
      return onChange({
        ...filter,
        initial: isEmpty(values) ? undefined : 'pluginId',
        pluginIds: mapToSet(values),
      });
    }
    onChange({
      ...filter,
      pluginIds: mapToSet(values),
    });
  };

  const onChangeExtensionPointIds = (values: Array<SelectableValue<string>>) => {
    if (isEmpty(filter.pluginIds) && isEmpty(filter.severity)) {
      return onChange({
        ...filter,
        initial: isEmpty(values) ? undefined : 'extensionPointId',
        extensionPointIds: mapToSet(values),
      });
    }
    onChange({
      ...filter,
      extensionPointIds: mapToSet(values),
    });
  };

  const onChangeSeverity = (values: Array<SelectableValue<string>>) => {
    if (isEmpty(filter.pluginIds) && isEmpty(filter.extensionPointIds)) {
      return onChange({
        ...filter,
        initial: isEmpty(values) ? undefined : 'severity',
        severity: mapToSet(values),
      });
    }
    onChange({
      ...filter,
      severity: mapToSet(values),
    });
  };

  return (
    <InlineFieldRow>
      <InlineField label="Plugin Id">
        <MultiSelect options={pluginIds} onChange={onChangePluginIds} />
      </InlineField>
      <InlineField label="Extension">
        <MultiSelect options={extensionPointIds} onChange={onChangeExtensionPointIds} />
      </InlineField>
      <InlineField label="Severity">
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
    // We only support single series for now
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
