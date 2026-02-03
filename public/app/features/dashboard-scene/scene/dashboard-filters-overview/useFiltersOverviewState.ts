import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { fuzzySearch, SelectableValue } from '@grafana/data';
import { AdHocFilterWithLabels, AdHocFiltersVariable, GroupByVariable, OPERATORS } from '@grafana/scenes';
import { ComboboxOption } from '@grafana/ui';

import { buildAdHocApplyFilters, buildGroupByUpdate, buildOverviewState } from './utils';

export const ROW_HEIGHT = 40;
export const GROUP_HEADER_HEIGHT = 50;

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

// Helpers
const getGroupByValues = (groupByVariable?: GroupByVariable): string[] => {
  if (!groupByVariable) {
    return [];
  }
  const value = groupByVariable.state.value;
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((entry) => entry.toString());
};

const splitKeysByGroup = (keys: Array<SelectableValue<string>>) => {
  const groups = new Map<string, Array<SelectableValue<string>>>();
  const ungrouped: Array<SelectableValue<string>> = [];

  for (const key of keys) {
    const group = key.group;
    if (!group) {
      ungrouped.push(key);
    } else {
      const groupKeys = groups.get(group);
      if (groupKeys) {
        groupKeys.push(key);
      } else {
        groups.set(group, [key]);
      }
    }
  }

  return {
    groupNames: Array.from(groups.keys()),
    groupedKeys: groups,
    ungroupedKeys: ungrouped,
  };
};

const filterKeysBySearch = (
  keys: Array<SelectableValue<string>>,
  groupNames: string[],
  searchTerm: string
): Array<SelectableValue<string>> => {
  if (!searchTerm) {
    return keys;
  }

  const haystack = keys.map((keyOption) => (keyOption.label ?? keyOption.value ?? '').toString());
  const matchingKeyIndices = fuzzySearch(haystack, searchTerm);
  const matchingKeyValues = new Set(
    matchingKeyIndices
      .map((index) => keys[index]?.value ?? keys[index]?.label)
      .filter((value): value is string => Boolean(value))
  );
  const matchingGroupNames = new Set(
    fuzzySearch(groupNames, searchTerm)
      .map((index) => groupNames[index])
      .filter(Boolean)
  );

  return keys.filter((keyOption) => {
    const keyValue = keyOption.value ?? keyOption.label;
    if (!keyValue) {
      return false;
    }
    if (matchingKeyValues.has(keyValue)) {
      return true;
    }
    if (keyOption.group && matchingGroupNames.has(keyOption.group)) {
      return true;
    }
    return false;
  });
};

// Flatten list for faster rendering
const buildListItems = (
  ungroupedKeys: Array<SelectableValue<string>>,
  groupNames: string[],
  groupedKeys: Map<string, Array<SelectableValue<string>>>,
  openGroups: Record<string, boolean>
): ListItem[] => {
  const items: ListItem[] = [];

  for (const keyOption of ungroupedKeys) {
    const keyValue = keyOption.value ?? keyOption.label;
    if (keyValue) {
      items.push({ type: 'row', keyOption, keyValue });
    }
  }

  for (const group of groupNames) {
    items.push({ type: 'group', group });
    if (openGroups[group] ?? true) {
      const keys = groupedKeys.get(group) ?? [];
      for (const keyOption of keys) {
        const keyValue = keyOption.value ?? keyOption.label;
        if (keyValue) {
          items.push({ type: 'row', keyOption, keyValue });
        }
      }
    }
  }

  return items;
};

export function useFiltersOverviewState({ adhocFilters, groupByVariable, searchQuery }: UseFiltersOverviewStateOptions) {
  // Core state
  const [state, setState] = useState<FiltersOverviewState>({
    keys: [],
    operatorsByKey: {},
    singleValuesByKey: {},
    multiValuesByKey: {},
    isGrouped: {},
    isOriginByKey: {},
    openGroups: {},
  });

  // Value options cache
  const [valueOptionsByKey, setValueOptionsByKey] = useState<Record<string, Array<ComboboxOption<string>>>>({});

  // Operator configuration (memoized)
  const operatorConfig = useMemo(() => {
    const options = OPERATORS.map((op) => ({ label: op.value, value: op.value }));
    const multiValues = new Set<string>(OPERATORS.filter((op) => op.isMulti).map((op) => op.value));
    return { options, multiValues };
  }, []);

  // Initialize state from adhocFilters and groupByVariable
  useEffect(() => {
    if (!adhocFilters) {
      return;
    }

    const initializeState = async () => {
      const { keys, operatorsByKey, multiValuesByKey, singleValuesByKey, isOriginByKey } = buildOverviewState(
        adhocFilters.state,
        operatorConfig.multiValues
      );

      // Fetch additional keys from datasource
      keys.push(...(await adhocFilters._getKeys(null)));

      // Add groupBy values as keys if not already present
      if (groupByVariable) {
        const groupByValues = getGroupByValues(groupByVariable);
        const existingKeys = new Set(keys.map((key) => key.value ?? key.label).filter(Boolean));
        for (const keyValue of groupByValues) {
          if (!existingKeys.has(keyValue)) {
            keys.push({ label: keyValue, value: keyValue });
            existingKeys.add(keyValue);
          }
        }
      }

      // Initialize groupBy state
      const isGrouped: Record<string, boolean> = {};
      if (groupByVariable) {
        for (const selectedKey of getGroupByValues(groupByVariable)) {
          isGrouped[selectedKey] = true;
        }
      }

      setState((prev) => ({
        ...prev,
        keys,
        operatorsByKey,
        multiValuesByKey,
        singleValuesByKey,
        isOriginByKey,
        isGrouped,
      }));
    };

    initializeState();
  }, [adhocFilters, groupByVariable, operatorConfig.multiValues]);

  // Compute group names and initialize openGroups
  const { groupNames } = useMemo(() => splitKeysByGroup(state.keys), [state.keys]);

  useEffect(() => {
    if (groupNames.length === 0) {
      return;
    }
    setState((prev) => {
      const nextOpenGroups = { ...prev.openGroups };
      let changed = false;
      for (const group of groupNames) {
        if (nextOpenGroups[group] === undefined) {
          nextOpenGroups[group] = true;
          changed = true;
        }
      }
      return changed ? { ...prev, openGroups: nextOpenGroups } : prev;
    });
  }, [groupNames]);

  // Filtered keys based on search
  const searchTerm = searchQuery.trim();
  const filteredKeys = useMemo(
    () => filterKeysBySearch(state.keys, groupNames, searchTerm),
    [state.keys, groupNames, searchTerm]
  );

  // Build list items for virtualized list
  const listItems = useMemo(() => {
    const { groupNames, groupedKeys, ungroupedKeys } = splitKeysByGroup(filteredKeys);
    return buildListItems(ungroupedKeys, groupNames, groupedKeys, state.openGroups);
  }, [filteredKeys, state.openGroups]);

  // Actions
  const actions: FiltersOverviewActions = useMemo(
    () => ({
      toggleGroup: (group: string, isOpen: boolean) => {
        setState((prev) => ({ ...prev, openGroups: { ...prev.openGroups, [group]: isOpen } }));
      },

      setOperator: (key: string, operator: string) => {
        setState((prev) => ({ ...prev, operatorsByKey: { ...prev.operatorsByKey, [key]: operator } }));
      },

      setSingleValue: (key: string, value: string) => {
        setState((prev) => ({ ...prev, singleValuesByKey: { ...prev.singleValuesByKey, [key]: value } }));
      },

      setMultiValues: (key: string, values: string[]) => {
        setState((prev) => ({ ...prev, multiValuesByKey: { ...prev.multiValuesByKey, [key]: values } }));
      },

      toggleGroupBy: (key: string, nextValue: boolean) => {
        setState((prev) => ({ ...prev, isGrouped: { ...prev.isGrouped, [key]: nextValue } }));
      },

      getValueOptionsForKey: async (key: string, operator: string, inputValue: string) => {
        if (!adhocFilters) {
          return [];
        }

        let options = valueOptionsByKey[key];
        if (!options) {
          const filter: AdHocFilterWithLabels = { key, operator, value: '', condition: '' };
          const values = await adhocFilters._getValuesFor(filter);
          options = values.map((v) => ({
            label: v.label ?? v.value ?? '',
            value: v.value ?? v.label ?? '',
          }));
          setValueOptionsByKey((prev) => ({ ...prev, [key]: options }));
        }

        if (!inputValue) {
          return options;
        }

        const lowered = inputValue.toLowerCase();
        return options.filter((opt) => (opt.label ?? opt.value).toLowerCase().includes(lowered));
      },

      applyChanges: () => {
        if (groupByVariable) {
          const { nextValues, nextText } = buildGroupByUpdate(state.keys, state.isGrouped);
          groupByVariable.changeValueTo(nextValues, nextText, true);
        }

        if (adhocFilters) {
          const existingOriginFilters = adhocFilters.state.originFilters ?? [];
          const existingFilters = adhocFilters.state.filters ?? [];
          const { nextFilters, nextOriginFilters, nonApplicableOriginFilters, nonApplicableFilters } =
            buildAdHocApplyFilters({
              keys: state.keys,
              isOriginByKey: state.isOriginByKey,
              operatorsByKey: state.operatorsByKey,
              singleValuesByKey: state.singleValuesByKey,
              multiValuesByKey: state.multiValuesByKey,
              existingOriginFilters,
              existingFilters,
              multiOperatorValues: operatorConfig.multiValues,
            });

          const validatedOriginFilters = adhocFilters.validateOriginFilters([
            ...nextOriginFilters,
            ...nonApplicableOriginFilters,
          ]);

          adhocFilters.setState({
            filters: [...nextFilters, ...nonApplicableFilters],
            originFilters: validatedOriginFilters,
          });
        }
      },
    }),
    [adhocFilters, groupByVariable, operatorConfig.multiValues, state, valueOptionsByKey]
  );

  return {
    state,
    listItems,
    operatorConfig,
    actions,
    hasKeys: state.keys.length > 0,
    hasAdhocFilters: Boolean(adhocFilters),
  };
}

// Hook for managing virtualized list sizing
export function useVirtualListSizing() {
  const [listWidth, setListWidth] = useState(0);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<any>(null);
  const sizeMapRef = useRef(new Map<number, number>());

  // Track container width for resize handling
  useLayoutEffect(() => {
    const node = listContainerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0]?.contentRect?.width ?? 0);
      setListWidth((current) => (current === nextWidth ? current : nextWidth));
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const setRowHeight = useCallback((index: number, size: number) => {
    const nextSize = Math.max(size, ROW_HEIGHT);
    const currentSize = sizeMapRef.current.get(index);
    if (currentSize !== nextSize) {
      sizeMapRef.current.set(index, nextSize);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const resetSizes = useCallback(() => {
    sizeMapRef.current = new Map();
    listRef.current?.resetAfterIndex(0, true);
  }, []);

  const getItemSize = useCallback(
    (index: number, itemType: 'group' | 'row') => {
      return itemType === 'group' ? GROUP_HEADER_HEIGHT : sizeMapRef.current.get(index) ?? ROW_HEIGHT;
    },
    []
  );

  return {
    listWidth,
    listContainerRef,
    listRef,
    setRowHeight,
    resetSizes,
    getItemSize,
  };
}
