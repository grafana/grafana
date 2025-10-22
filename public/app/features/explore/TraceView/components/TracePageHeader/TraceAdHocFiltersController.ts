import { isEqual } from 'lodash';

import { SelectableValue, toOption, TraceSearchProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersController, AdHocFiltersControllerState, AdHocFilterWithLabels } from '@grafana/scenes';

import { getTraceTagKeys, getTraceTagValues } from '../../utils/tags';
import { Trace } from '../types/trace';

/**
 * Convert AdHocFilterItem to AdHocFilterWithLabels for use with the combobox.
 */
function toAdHocFilterWithLabels(item: SelectableValue<string>): AdHocFilterWithLabels {
  return {
    ...item,
    key: item.key,
    operator: item.operator,
    value: item.value || '',
  };
}

/**
 * Convert AdHocFilterWithLabels back to AdHocFilterItem for storage.
 */
function toAdHocFilterItem(filter: AdHocFilterWithLabels): SelectableValue<string> {
  return {
    ...filter,
    key: filter.key || '',
    operator: filter.operator || '=',
    value: filter.value || '',
  };
}

const TRACE_OPERATORS = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '=~', value: '=~' },
  { label: '!~', value: '!~' },
];

/**
 * Controller for adhoc filters in trace view.
 * Provides keys and values from trace spans and syncs state with URL.
 */
export class TraceAdHocFiltersController implements AdHocFiltersController {
  private trace: Trace;
  private search: TraceSearchProps;
  private setSearch: (search: TraceSearchProps) => void;
  private wip: AdHocFilterWithLabels | undefined;
  private setWip: (wip: AdHocFilterWithLabels | undefined) => void;

  constructor(
    trace: Trace,
    search: TraceSearchProps,
    setSearch: (search: TraceSearchProps) => void,
    wip: AdHocFilterWithLabels | undefined,
    setWip: (wip: AdHocFilterWithLabels | undefined) => void
  ) {
    this.trace = trace;
    this.search = search;
    this.setSearch = setSearch;
    this.wip = wip;
    this.setWip = setWip;
  }

  /**
   * React hook to access controller state.
   */
  useState(): AdHocFiltersControllerState {
    const filters = (this.search.adhocFilters || []).map(toAdHocFilterWithLabels);

    return {
      filters,
      readOnly: false,
      allowCustomValue: true,
      supportsMultiValueOperators: false,
      wip: this.wip,
      inputPlaceholder: 'Filter by attribute or text',
    };
  }

  /**
   * Get possible keys from trace spans.
   */
  async getKeys(currentKey: string | null): Promise<Array<SelectableValue<string>>> {
    const keys = getTraceTagKeys(this.trace);
    return [
      {
        label: t('traces.adhocFilters.textSearchLabel', 'Text search'),
        value: '_textSearch_',
        description: t('traces.adhocFilters.textSearchDescription', 'Search for text in the trace'),
      },
      { label: t('traces.adhocFilters.durationLabel', 'duration'), value: 'duration' },
      ...keys.map(toOption),
    ];
  }

  /**
   * Get possible values for a specific filter key from trace spans.
   */
  async getValuesFor(filter: AdHocFilterWithLabels): Promise<Array<SelectableValue<string>>> {
    if (!filter.key) {
      return [];
    }
    if (filter.key === 'duration') {
      return [
        { label: t('traces.adhocFilters.duration1ms', '1ms'), value: '1ms' },
        { label: t('traces.adhocFilters.duration1s', '1s'), value: '1s' },
        { label: t('traces.adhocFilters.duration1m', '1m'), value: '1m' },
        { label: t('traces.adhocFilters.duration1h', '1h'), value: '1h' },
      ];
    }

    if (filter.key === '_textSearch_') {
      return [{ label: t('traces.adhocFilters.customValue', 'Type a value'), value: 'customValue', isDisabled: true }];
    }
    const values = getTraceTagValues(this.trace, filter.key);
    return values.map(toOption);
  }

  /**
   * Get available operators.
   */
  getOperators(): Array<SelectableValue<string>> {
    if (this.wip?.key === '_textSearch_') {
      return [{ label: '=~', value: '=~' }];
    }
    if (this.wip?.key === 'duration') {
      return [
        { label: '>=', value: '>=' },
        { label: '<=', value: '<=' },
      ];
    }
    return TRACE_OPERATORS;
  }

  /**
   * Update a filter with partial changes.
   */
  updateFilter(filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>): void {
    const items = this.search.adhocFilters || [];
    const filters = items.map(toAdHocFilterWithLabels);

    if (filter === this.wip) {
      // If we set value we are done with this "work in progress" filter and we can add it
      if ('value' in update && update['value'] !== '') {
        this.setSearch({
          ...this.search,
          adhocFilters: [...filters, { ...this.wip, ...update }],
        });
        this.setWip(undefined);
      } else {
        this.setWip({ ...this.wip, ...update });
      }
      return;
    }

    const updatedFilters = filters.map((f) => {
      return isEqual(f, filter) ? { ...f, ...update } : f;
    });

    this.setSearch({
      ...this.search,
      adhocFilters: updatedFilters.map(toAdHocFilterItem),
    });
  }

  /**
   * Update a filter to match all values (=~ .*).
   */
  updateToMatchAll(filter: AdHocFilterWithLabels): void {
    this.updateFilter(filter, {
      operator: '=~',
      value: '.*',
      matchAllFilter: true,
    });
  }

  /**
   * Remove a filter.
   */
  removeFilter(filter: AdHocFilterWithLabels): void {
    const items = this.search.adhocFilters || [];
    const filters = items.map(toAdHocFilterWithLabels);

    const updatedFilters = filters.filter((f) => !isEqual(f, filter));

    this.setSearch({
      ...this.search,
      adhocFilters: updatedFilters.map(toAdHocFilterItem),
    });
  }

  /**
   * Remove the last filter in the list.
   */
  removeLastFilter(): void {
    const filters = this.search.adhocFilters || [];
    if (filters.length > 0) {
      const updatedFilters = filters.slice(0, -1);
      this.setSearch({
        ...this.search,
        adhocFilters: updatedFilters,
      });
    }
  }

  /**
   * Handle backspace key in combobox.
   */
  handleComboboxBackspace(filter: AdHocFilterWithLabels): void {
    const items = this.search.adhocFilters || [];
    const filters = items.map(toAdHocFilterWithLabels);

    const index = filters.findIndex((f) => isEqual(f, filter));

    if (index > 0) {
      // Focus previous filter by setting forceEdit
      const updatedFilters = filters.map((f, i) => {
        if (i === index - 1) {
          return { ...f, forceEdit: true };
        }
        return { ...f, forceEdit: false };
      });

      this.setSearch({
        ...this.search,
        adhocFilters: updatedFilters.map(toAdHocFilterItem),
      });
    }
  }

  /**
   * Add a new work-in-progress filter.
   */
  addWip(): void {
    this.setWip(toAdHocFilterWithLabels({ key: '', operator: '=', value: '' }));
  }

  /**
   * Restore an origin filter to its original value.
   * Not applicable for trace filters.
   */
  restoreOriginalFilter(filter: AdHocFilterWithLabels): void {
    // Not applicable for trace filters as they don't have origin filters
  }
}
