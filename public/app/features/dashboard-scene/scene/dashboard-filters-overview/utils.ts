import { SelectableValue } from '@grafana/data';
import { AdHocFilterWithLabels, OPERATORS } from '@grafana/scenes';

export const MULTI_OPERATOR_VALUES = new Set(OPERATORS.filter((op) => op.isMulti).map((op) => op.value));

export interface OverviewInitState {
  keys: Array<SelectableValue<string>>;
  operatorsByKey: Record<string, string>;
  singleValuesByKey: Record<string, string>;
  multiValuesByKey: Record<string, string[]>;
  isOriginByKey: Record<string, boolean>;
}

export function buildOverviewState(filtersState: {
  originFilters?: AdHocFilterWithLabels[];
  filters: AdHocFilterWithLabels[];
}): OverviewInitState {
  const keys: Array<SelectableValue<string>> = [];
  const operatorsByKey: Record<string, string> = {};
  const multiValuesByKey: Record<string, string[]> = {};
  const singleValuesByKey: Record<string, string> = {};
  const isOriginByKey: Record<string, boolean> = {};

  for (const originFilter of filtersState.originFilters ?? []) {
    if (originFilter.nonApplicable) {
      continue;
    }
    keys.push({ label: originFilter.keyLabel, value: originFilter.key });
    operatorsByKey[originFilter.key] = '=';
    isOriginByKey[originFilter.key] = true;

    if (originFilter.matchAllFilter) {
      singleValuesByKey[originFilter.key] = '';
    } else {
      singleValuesByKey[originFilter.key] = originFilter.value!;
    }
  }

  for (const selectedFilter of filtersState.filters) {
    if (selectedFilter.nonApplicable) {
      continue;
    }
    keys.push({ label: selectedFilter.keyLabel, value: selectedFilter.key });
    operatorsByKey[selectedFilter.key] = selectedFilter.operator;
    isOriginByKey[selectedFilter.key] = false;
    if (
      selectedFilter.values &&
      selectedFilter.values.length > 0 &&
      MULTI_OPERATOR_VALUES.has(selectedFilter.operator)
    ) {
      multiValuesByKey[selectedFilter.key] = selectedFilter.values!;
    } else {
      singleValuesByKey[selectedFilter.key] = selectedFilter.value!;
    }
  }

  return {
    keys,
    operatorsByKey,
    singleValuesByKey,
    multiValuesByKey,
    isOriginByKey,
  };
}

export function buildGroupByUpdate(
  keys: Array<SelectableValue<string>>,
  isGrouped: Record<string, boolean>
): { nextValues: string[]; nextText: string[] } {
  const keyLabels = new Map<string, string>();
  for (const keyOption of keys) {
    const keyValue = keyOption.value ?? keyOption.label;
    if (!keyValue) {
      continue;
    }
    keyLabels.set(keyValue, keyOption.label ?? keyValue);
  }

  const nextValues = Object.entries(isGrouped)
    .filter(([, enabled]) => enabled)
    .map(([keyValue]) => keyValue);
  const nextText = nextValues.map((value) => keyLabels.get(value) ?? value);

  return { nextValues, nextText };
}

export interface ApplyFiltersInput {
  keys: Array<SelectableValue<string>>;
  isOriginByKey: Record<string, boolean>;
  operatorsByKey: Record<string, string>;
  singleValuesByKey: Record<string, string>;
  multiValuesByKey: Record<string, string[]>;
  existingOriginFilters: AdHocFilterWithLabels[];
  existingFilters: AdHocFilterWithLabels[];
}

export interface ApplyFiltersOutput {
  nextFilters: AdHocFilterWithLabels[];
  nextOriginFilters: AdHocFilterWithLabels[];
  nonApplicableOriginFilters: AdHocFilterWithLabels[];
  nonApplicableFilters: AdHocFilterWithLabels[];
}

export function buildAdHocApplyFilters({
  keys,
  isOriginByKey,
  operatorsByKey,
  singleValuesByKey,
  multiValuesByKey,
  existingOriginFilters,
  existingFilters,
}: ApplyFiltersInput): ApplyFiltersOutput {
  const nextFilters: AdHocFilterWithLabels[] = [];
  const nextOriginFilters: AdHocFilterWithLabels[] = [];
  const nonApplicableOriginFilters = existingOriginFilters.filter((filter) => filter.nonApplicable);
  const nonApplicableFilters = existingFilters.filter((filter) => filter.nonApplicable);

  for (const keyOption of keys) {
    const keyValue = keyOption.value ?? keyOption.label;
    if (!keyValue) {
      continue;
    }

    const isOrigin = isOriginByKey[keyValue] ?? false;
    const existingOrigin = existingOriginFilters.find((filter) => filter.key === keyValue && !filter.nonApplicable);
    const existingFilter = existingFilters.find((filter) => filter.key === keyValue && !filter.nonApplicable);

    const operatorValue = isOrigin ? '=' : (operatorsByKey[keyValue] ?? '=');
    const isMultiOperator = MULTI_OPERATOR_VALUES.has(operatorValue);
    const singleValue = singleValuesByKey[keyValue] ?? '';
    const multiValues = multiValuesByKey[keyValue] ?? [];

    if (isMultiOperator) {
      if (multiValues.length === 0) {
        if (isOrigin) {
          nextOriginFilters.push({
            ...(existingOrigin ?? {}),
            key: keyValue,
            keyLabel: keyOption.label ?? keyValue,
            operator: operatorValue,
            value: '',
            values: undefined,
            valueLabels: undefined,
          });
        }
        continue;
      }
      const filter: AdHocFilterWithLabels = {
        ...(isOrigin ? existingOrigin : existingFilter),
        key: keyValue,
        keyLabel: keyOption.label ?? keyValue,
        operator: operatorValue,
        value: multiValues[0],
        values: multiValues,
        valueLabels: multiValues,
      };
      if (isOrigin) {
        nextOriginFilters.push(filter);
      } else {
        nextFilters.push(filter);
      }
    } else {
      if (!singleValue) {
        if (isOrigin) {
          nextOriginFilters.push({
            ...(existingOrigin ?? {}),
            key: keyValue,
            keyLabel: keyOption.label ?? keyValue,
            operator: operatorValue,
            value: '',
            values: undefined,
            valueLabels: undefined,
          });
        }
        continue;
      }
      const filter: AdHocFilterWithLabels = {
        ...(isOrigin ? existingOrigin : existingFilter),
        key: keyValue,
        keyLabel: keyOption.label ?? keyValue,
        operator: operatorValue,
        value: singleValue,
        values: undefined,
        valueLabels: undefined,
      };
      if (isOrigin) {
        nextOriginFilters.push(filter);
      } else {
        nextFilters.push(filter);
      }
    }
  }

  return {
    nextFilters,
    nextOriginFilters,
    nonApplicableOriginFilters,
    nonApplicableFilters,
  };
}
