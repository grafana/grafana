import { useEffect, useMemo, useState } from 'react';

import { fuzzySearch, SelectableValue } from '@grafana/data';
import { AdHocFilterWithLabels, AdHocFiltersVariable, GroupByVariable, OPERATORS } from '@grafana/scenes';
import { ComboboxOption } from '@grafana/ui';

import { buildAdHocApplyFilters, buildGroupByUpdate, buildOverviewState } from './utils';

export type ListItem =
  | { type: 'group'; group: string }
  | { type: 'row'; keyOption: SelectableValue<string>; keyValue: string };

export interface FiltersOverviewState {
  keys: Array<SelectableValue<string>>;
  operatorsByKey: Record<string, string>;
  singleValuesByKey: Record<string, string>;
  multiValuesByKey: Record<string, string[]>;
  isGrouped: Record<string, boolean>;
  isOriginByKey: Record<string, boolean>;
  openGroups: Record<string, boolean>;
}

export interface FiltersOverviewActions {
  toggleGroup: (group: string, isOpen: boolean) => void;
  setOperator: (key: string, operator: string) => void;
  setSingleValue: (key: string, value: string) => void;
  setMultiValues: (key: string, values: string[]) => void;
  toggleGroupBy: (key: string, nextValue: boolean) => void;
  getValueOptionsForKey: (key: string, operator: string, inputValue: string) => Promise<Array<ComboboxOption<string>>>;
  applyChanges: () => void;
}

interface UseFiltersOverviewStateOptions {
  adhocFilters?: AdHocFiltersVariable;
  groupByVariable?: GroupByVariable;
  searchQuery: string;
}

// Helper: Get groupBy values from variable
const getGroupByValues = (groupByVariable?: GroupByVariable): string[] => {
  if (!groupByVariable) {
    return [];
  }
  const value = groupByVariable.state.value;
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((entry) => entry.toString());
};

// Helper: Split keys into grouped and ungrouped
const splitKeysByGroup = (keys: Array<SelectableValue<string>>) => {
  const groups = new Map<string, Array<SelectableValue<string>>>();
  const ungrouped: Array<SelectableValue<string>> = [];

  for (const key of keys) {
    if (key.group) {
      const groupKeys = groups.get(key.group) ?? [];
      groupKeys.push(key);
      groups.set(key.group, groupKeys);
    } else {
      ungrouped.push(key);
    }
  }

  return {
    groupNames: Array.from(groups.keys()),
    groupedKeys: groups,
    ungroupedKeys: ungrouped,
  };
};

// Helper: Filter keys by search term
const filterKeysBySearch = (
  keys: Array<SelectableValue<string>>,
  groupNames: string[],
  searchTerm: string
): Array<SelectableValue<string>> => {
  if (!searchTerm) {
    return keys;
  }

  const haystack = keys.map((k) => (k.label ?? k.value ?? '').toString());
  const matchingKeyIndices = fuzzySearch(haystack, searchTerm);
  const matchingKeyValues = new Set(
    matchingKeyIndices.map((i) => keys[i]?.value ?? keys[i]?.label).filter((v): v is string => Boolean(v))
  );
  const matchingGroupNames = new Set(
    fuzzySearch(groupNames, searchTerm)
      .map((i) => groupNames[i])
      .filter(Boolean)
  );

  return keys.filter((k) => {
    const keyValue = k.value ?? k.label;
    return keyValue && (matchingKeyValues.has(keyValue) || (k.group && matchingGroupNames.has(k.group)));
  });
};

// Helper: Build flat list items from keys
const buildListItems = (
  ungroupedKeys: Array<SelectableValue<string>>,
  groupNames: string[],
  groupedKeys: Map<string, Array<SelectableValue<string>>>,
  openGroups: Record<string, boolean>
): ListItem[] => {
  const items: ListItem[] = [];

  // Add ungrouped items first
  for (const keyOption of ungroupedKeys) {
    const keyValue = keyOption.value ?? keyOption.label;
    if (keyValue) {
      items.push({ type: 'row', keyOption, keyValue });
    }
  }

  // Add grouped items
  for (const group of groupNames) {
    items.push({ type: 'group', group });
    if (openGroups[group] ?? true) {
      for (const keyOption of groupedKeys.get(group) ?? []) {
        const keyValue = keyOption.value ?? keyOption.label;
        if (keyValue) {
          items.push({ type: 'row', keyOption, keyValue });
        }
      }
    }
  }

  return items;
};

export function useFiltersOverviewState({
  adhocFilters,
  groupByVariable,
  searchQuery,
}: UseFiltersOverviewStateOptions) {
  const [state, setState] = useState<FiltersOverviewState>({
    keys: [],
    operatorsByKey: {},
    singleValuesByKey: {},
    multiValuesByKey: {},
    isGrouped: {},
    isOriginByKey: {},
    openGroups: {},
  });

  const [loading, setLoading] = useState(true);
  const [valueOptionsByKey, setValueOptionsByKey] = useState<Record<string, Array<ComboboxOption<string>>>>({});

  const operatorConfig = useMemo(
    () => ({
      options: OPERATORS.map((op) => ({ label: op.value, value: op.value })),
    }),
    []
  );

  // Initialize state from filters
  useEffect(() => {
    if (!adhocFilters) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const init = async () => {
      const { keys, operatorsByKey, multiValuesByKey, singleValuesByKey, isOriginByKey } = buildOverviewState(
        adhocFilters.state
      );

      const existingKeyValues = new Set(keys.map((k) => k.value ?? k.label).filter(Boolean));
      for (const key of await adhocFilters._getKeys(null)) {
        const keyValue = key.value ?? key.label;
        if (keyValue && !existingKeyValues.has(keyValue)) {
          keys.push(key);
          existingKeyValues.add(keyValue);
        }
      }

      const isGrouped: Record<string, boolean> = {};
      if (groupByVariable) {
        for (const v of getGroupByValues(groupByVariable)) {
          isGrouped[v] = true;
          if (!existingKeyValues.has(v)) {
            keys.push({ label: v, value: v });
            existingKeyValues.add(v);
          }
        }
      }

      const { groupNames } = splitKeysByGroup(keys);
      const openGroups: Record<string, boolean> = Object.fromEntries(groupNames.map((g) => [g, true]));

      setState((prev) => ({
        ...prev,
        keys,
        operatorsByKey,
        multiValuesByKey,
        singleValuesByKey,
        isOriginByKey,
        isGrouped,
        openGroups,
      }));
      setLoading(false);
    };

    init().catch(() => {
      setLoading(false);
    });
  }, [adhocFilters, groupByVariable]);

  const { groupNames } = useMemo(() => splitKeysByGroup(state.keys), [state.keys]);

  // Filter and build list items
  const searchTerm = searchQuery.trim();
  const filteredKeys = useMemo(
    () => filterKeysBySearch(state.keys, groupNames, searchTerm),
    [state.keys, groupNames, searchTerm]
  );

  const listItems = useMemo(() => {
    const { groupNames, groupedKeys, ungroupedKeys } = splitKeysByGroup(filteredKeys);
    return buildListItems(ungroupedKeys, groupNames, groupedKeys, state.openGroups);
  }, [filteredKeys, state.openGroups]);

  const actions: FiltersOverviewActions = {
    toggleGroup: (group, isOpen) => {
      setState((prev) => ({ ...prev, openGroups: { ...prev.openGroups, [group]: isOpen } }));
    },

    setOperator: (key, operator) => {
      setState((prev) => ({ ...prev, operatorsByKey: { ...prev.operatorsByKey, [key]: operator } }));
    },

    setSingleValue: (key, value) => {
      setState((prev) => ({ ...prev, singleValuesByKey: { ...prev.singleValuesByKey, [key]: value } }));
    },

    setMultiValues: (key, values) => {
      setState((prev) => ({ ...prev, multiValuesByKey: { ...prev.multiValuesByKey, [key]: values } }));
    },

    toggleGroupBy: (key, nextValue) => {
      setState((prev) => ({ ...prev, isGrouped: { ...prev.isGrouped, [key]: nextValue } }));
    },

    getValueOptionsForKey: async (key, operator, inputValue) => {
      if (!adhocFilters) {
        return [];
      }

      let options = valueOptionsByKey[key];
      if (!options) {
        const filter: AdHocFilterWithLabels = { key, operator, value: '' };
        const values = await adhocFilters._getValuesFor(filter);
        options = values.map((v) => ({
          label: v.label ?? v.value ?? '',
          value: v.value ?? '',
        }));
        setValueOptionsByKey((prev) => ({ ...prev, [key]: options }));
      }

      if (!inputValue) {
        return options;
      }
      const lowered = inputValue.toLowerCase();
      return options.filter((o) => (o.label ?? o.value).toLowerCase().includes(lowered));
    },

    applyChanges: () => {
      if (groupByVariable) {
        const { nextValues, nextText } = buildGroupByUpdate(state.keys, state.isGrouped);
        groupByVariable.changeValueTo(nextValues, nextText, true);
      }

      if (adhocFilters) {
        const { nextFilters, nextOriginFilters, nonApplicableOriginFilters, nonApplicableFilters } =
          buildAdHocApplyFilters({
            keys: state.keys,
            isOriginByKey: state.isOriginByKey,
            operatorsByKey: state.operatorsByKey,
            singleValuesByKey: state.singleValuesByKey,
            multiValuesByKey: state.multiValuesByKey,
            existingOriginFilters: adhocFilters.state.originFilters ?? [],
            existingFilters: adhocFilters.state.filters ?? [],
          });

        adhocFilters.setState({
          filters: [...nextFilters, ...nonApplicableFilters],
          originFilters: adhocFilters.validateOriginFilters([...nextOriginFilters, ...nonApplicableOriginFilters]),
        });
      }
    },
  };

  return {
    state,
    listItems,
    operatorConfig,
    actions,
    loading,
    hasKeys: state.keys.length > 0,
    hasAdhocFilters: Boolean(adhocFilters),
  };
}
