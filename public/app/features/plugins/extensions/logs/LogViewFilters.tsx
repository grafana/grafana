import { isEmpty } from 'lodash';
import { ReactElement, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneQueryRunner } from '@grafana/scenes';
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui';

export type LogFilter = {
  pluginIds?: Set<string>;
  extensionPointIds?: Set<string>;
  levels?: Set<string>;
  initial?: string;
};

type LogViewFiltersProps = {
  queryRunner: SceneQueryRunner;
  filter: LogFilter;
  onChange: (filter: LogFilter) => void;
};

export function LogViewFilters({ queryRunner, filter, onChange }: LogViewFiltersProps): ReactElement {
  const { pluginIds, extensionPointIds, levels } = useLogFilters(queryRunner, filter);

  const onChangePluginIds = (values: Array<SelectableValue<string>>) => {
    if (isEmpty(filter.extensionPointIds) && isEmpty(filter.levels)) {
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
    if (isEmpty(filter.pluginIds) && isEmpty(filter.levels)) {
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

  const onChangeLevels = (values: Array<SelectableValue<string>>) => {
    if (isEmpty(filter.pluginIds) && isEmpty(filter.extensionPointIds)) {
      return onChange({
        ...filter,
        initial: isEmpty(values) ? undefined : 'level',
        levels: mapToSet(values),
      });
    }
    onChange({
      ...filter,
      levels: mapToSet(values),
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
      <InlineField label="Levels">
        <MultiSelect options={levels} onChange={onChangeLevels} />
      </InlineField>
    </InlineFieldRow>
  );
}

type LogFilterOptions = {
  pluginIds: Array<SelectableValue<string>>;
  extensionPointIds: Array<SelectableValue<string>>;
  levels: Array<SelectableValue<string>>;
};

function useLogFilters(queryRunner: SceneQueryRunner, filter: LogFilter): LogFilterOptions {
  const { data } = queryRunner.useState();

  return useMemo(() => {
    // We only support single series for now
    const frame = data?.series[0];

    if (!frame) {
      return {
        pluginIds: [],
        extensionPointIds: [],
        levels: [],
      };
    }

    const levelsIndex = frame.fields.findIndex((f) => f.name === 'severity');
    const pluginIdIndex = frame.fields.findIndex((f) => f.name === 'pluginId');
    const extensionPointIdIndex = frame.fields.findIndex((f) => f.name === 'extensionPointId');

    if (isEmpty(filter.extensionPointIds) && isEmpty(filter.levels) && isEmpty(filter.pluginIds)) {
      const levels = new Set<string>(frame.fields[levelsIndex].values);
      const pluginIds = new Set<string>(frame.fields[pluginIdIndex].values);
      const extensionPointIds = new Set<string>(frame.fields[extensionPointIdIndex].values);

      return {
        levels: toSelectableArray(levels),
        pluginIds: toSelectableArray(pluginIds),
        extensionPointIds: toSelectableArray(extensionPointIds),
      };
    }

    const filters = {
      pluginIds: new Set<string>(),
      extensionPointIds: new Set<string>(),
      levels: new Set<string>(),
    };

    for (let index = 0; index < frame.length; index++) {
      const level = frame.fields[levelsIndex].values[index];
      const pluginId = frame.fields[pluginIdIndex].values[index];
      const extensionPointId = frame.fields[extensionPointIdIndex].values[index];

      switch (filter.initial) {
        case 'extensionPointId':
          filters.extensionPointIds.add(extensionPointId);
          break;
        case 'level':
          filters.levels.add(level);
          break;
        case 'pluginId':
          filters.pluginIds.add(pluginId);
          break;
      }

      if (isEmpty(filter.extensionPointIds)) {
        if (isEmpty(filter.levels)) {
          if (filter.pluginIds?.has(pluginId)) {
            filters.extensionPointIds.add(extensionPointId);
            filters.pluginIds.add(pluginId);
            filters.levels.add(level);
            continue;
          }
        }

        if (filter.pluginIds?.has(pluginId) && filter.levels?.has(level)) {
          filters.extensionPointIds.add(extensionPointId);
          filters.pluginIds.add(pluginId);
          filters.levels.add(level);
          continue;
        }
      }

      if (isEmpty(filter.pluginIds)) {
        if (isEmpty(filter.levels)) {
          if (filter.extensionPointIds?.has(extensionPointId)) {
            filters.extensionPointIds.add(extensionPointId);
            filters.pluginIds.add(pluginId);
            filters.levels.add(level);
            continue;
          }
        }

        if (filter.extensionPointIds?.has(extensionPointId) && filter.levels?.has(level)) {
          filters.extensionPointIds.add(extensionPointId);
          filters.pluginIds.add(pluginId);
          filters.levels.add(level);
          continue;
        }
      }

      if (isEmpty(filter.levels)) {
        if (isEmpty(filter.extensionPointIds)) {
          if (filter.pluginIds?.has(pluginId)) {
            filters.extensionPointIds.add(extensionPointId);
            filters.pluginIds.add(pluginId);
            filters.levels.add(level);
            continue;
          }
        }

        if (filter.extensionPointIds?.has(extensionPointId) && filter.pluginIds?.has(pluginId)) {
          filters.extensionPointIds.add(extensionPointId);
          filters.pluginIds.add(pluginId);
          filters.levels.add(level);
          continue;
        }
      }

      if (
        filter.levels?.has(level) &&
        filter.pluginIds?.has(pluginId) &&
        filter.extensionPointIds?.has(extensionPointId)
      ) {
        filters.extensionPointIds.add(extensionPointId);
        filters.pluginIds.add(pluginId);
        filters.levels.add(level);
      }
    }

    return {
      extensionPointIds: toSelectableArray(filters.extensionPointIds),
      pluginIds: toSelectableArray(filters.pluginIds),
      levels: toSelectableArray(filters.levels),
    };
  }, [data, filter]);
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

function mapToSet(selected: Array<SelectableValue<string>>): Set<string> | undefined {
  if (selected.length <= 0) {
    return undefined;
  }

  return new Set<string>(selected.map((item) => item.value!));
}
