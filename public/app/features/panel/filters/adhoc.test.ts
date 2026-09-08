import { createDataFrame, FieldType } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type AdHocFilterItem } from '@grafana/ui';

import { getFilterByGroupedLabels, getGroupedFilters } from './adhoc';

describe('getGroupedFilters', () => {
  it('returns empty array if no field', () => {
    const df = createDataFrame({
      fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
    });

    expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
  });

  it('returns empty array if no labels', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        {
          name: 'value',
          type: FieldType.number,
          values: [1, 2, 3],
        },
      ],
    });

    expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
  });

  it('returns empty array if field not filterable', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        {
          name: 'value',
          type: FieldType.number,
          values: [1, 2, 3],
          labels: {
            test: 'value',
            label: 'value2',
          },
        },
      ],
    });

    expect(getGroupedFilters(df, 1, jest.fn())).toEqual([]);
  });

  it('returns grouped filters', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        {
          name: 'value',
          type: FieldType.number,
          values: [1, 2, 3],
          labels: {
            test: 'value',
            label: 'value2',
          },
          config: {
            filterable: true,
          },
        },
      ],
    });

    const filtersGroupingFn = (filters: AdHocFilterItem[]) => filters;

    expect(getGroupedFilters(df, 1, filtersGroupingFn)).toEqual([
      {
        key: 'test',
        operator: '=',
        value: 'value',
      },
      {
        key: 'label',
        operator: '=',
        value: 'value2',
      },
    ]);
  });
});

describe('getFilterByGroupedLabels', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaFilterablePanels]: true });
  });

  afterEach(() => {
    setTestFlags();
  });

  const filterableFrame = createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3] },
      {
        name: 'value',
        type: FieldType.number,
        values: [1, 2, 3],
        labels: {
          test: 'value',
          label: 'value2',
        },
        config: {
          filterable: true,
        },
      },
    ],
  });

  const filtersGroupingFn = (filters: AdHocFilterItem[]) => filters;

  it('returns undefined when seriesIdx is null or undefined', () => {
    expect(getFilterByGroupedLabels(filterableFrame, null, filtersGroupingFn, jest.fn())).toBeUndefined();
    expect(getFilterByGroupedLabels(filterableFrame, undefined, filtersGroupingFn, jest.fn())).toBeUndefined();
  });

  it('returns undefined when panel context callbacks are missing', () => {
    expect(getFilterByGroupedLabels(filterableFrame, 1, undefined, jest.fn())).toBeUndefined();
    expect(getFilterByGroupedLabels(filterableFrame, 1, filtersGroupingFn, undefined)).toBeUndefined();
  });

  it('returns undefined when there are no grouped filters', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });

    expect(getFilterByGroupedLabels(df, 1, filtersGroupingFn, jest.fn())).toBeUndefined();
  });

  it('adds filters with the filter-for operator', () => {
    const onAddAdHocFilters = jest.fn();
    const model = getFilterByGroupedLabels(filterableFrame, 1, filtersGroupingFn, onAddAdHocFilters);

    model?.onFilterForGroupedLabels?.();

    expect(onAddAdHocFilters).toHaveBeenCalledWith([
      { key: 'test', operator: '=', value: 'value' },
      { key: 'label', operator: '=', value: 'value2' },
    ]);
  });

  it('adds filters with the filter-out operator', () => {
    const onAddAdHocFilters = jest.fn();
    const model = getFilterByGroupedLabels(filterableFrame, 1, filtersGroupingFn, onAddAdHocFilters);

    model?.onFilterOutGroupedLabels?.();

    expect(onAddAdHocFilters).toHaveBeenCalledWith([
      { key: 'test', operator: '!=', value: 'value' },
      { key: 'label', operator: '!=', value: 'value2' },
    ]);
  });

  it('returns undefined when the filterable panels flag is disabled', () => {
    setTestFlags({ [FlagKeys.GrafanaFilterablePanels]: false });

    expect(getFilterByGroupedLabels(filterableFrame, 1, filtersGroupingFn, jest.fn())).toBeUndefined();
  });

  it('skips the flag check when checkFilterablePanelsFlag is false', () => {
    setTestFlags({ [FlagKeys.GrafanaFilterablePanels]: false });

    const model = getFilterByGroupedLabels(filterableFrame, 1, filtersGroupingFn, jest.fn(), {
      checkFilterablePanelsFlag: false,
    });

    expect(model).toBeDefined();
  });
});
