import { type AdHocVariableFilter, type AdHocVariableModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type Dashboard, type VariableModel } from '@grafana/schema';
import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { adHocVariableFiltersEqual, getRawDashboardChanges, getRawDashboardV2Changes } from './getDashboardChanges';

describe('adHocVariableFiltersEqual', () => {
  it('should compare empty filters', () => {
    expect(adHocVariableFiltersEqual([], [])).toBeTruthy();
  });

  it('should compare different length filter arrays', () => {
    expect(adHocVariableFiltersEqual([], [{ value: '', key: '', operator: '' }])).toBeFalsy();
  });

  it('should compare equal filter arrays', () => {
    expect(
      adHocVariableFiltersEqual(
        [{ value: 'asd', key: 'qwe', operator: 'wer' }],
        [{ value: 'asd', key: 'qwe', operator: 'wer' }]
      )
    ).toBeTruthy();
  });

  it('should compare different filter arrays where operator differs', () => {
    expect(
      adHocVariableFiltersEqual(
        [{ value: 'asd', key: 'qwe', operator: 'wer' }],
        [{ value: 'asd', key: 'qwe', operator: 'weee' }]
      )
    ).toBeFalsy();
  });

  it('should compare different filter arrays where key differs', () => {
    expect(
      adHocVariableFiltersEqual(
        [{ value: 'asd', key: 'qwe', operator: 'wer' }],
        [{ value: 'asd', key: 'qwer', operator: 'wer' }]
      )
    ).toBeFalsy();
  });

  it('should compare different filter arrays where value differs', () => {
    expect(
      adHocVariableFiltersEqual(
        [{ value: 'asd', key: 'qwe', operator: 'wer' }],
        [{ value: 'asdio', key: 'qwe', operator: 'wer' }]
      )
    ).toBeFalsy();
  });

  describe('when filter property is undefined', () => {
    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should compare two adhoc variables where both are missing the filter property and return true', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
      expect(adHocVariableFiltersEqual(undefined, undefined)).toBeTruthy();

      expect(warnSpy).toHaveBeenCalledWith('Adhoc variable filter property is undefined');
    });

    it('should compare two adhoc variables where one is undefined and return false', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
      expect(adHocVariableFiltersEqual(undefined, [{ value: 'asdio', key: 'qwe', operator: 'wer' }])).toBeFalsy();

      expect(warnSpy).toHaveBeenCalledWith('Adhoc variable filter property is undefined');
    });
  });
});

describe('getDashboardChanges', () => {
  const initial: Dashboard = {
    id: 1,
    title: 'Dashboard 1',
    time: {
      from: 'now-7d',
      to: 'now',
    },
    refresh: '1h',
    version: 1,
    schemaVersion: 1,
    templating: {
      list: [
        {
          name: 'var1',
          type: 'query',
          query: 'query1',
          current: {
            value: 'value1',
            text: 'text1',
          },
          options: [],
        },
      ],
    },
  };

  it('should return the correct result when no changes', () => {
    const changed = { ...initial };

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...changed,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(initial, changed, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when is new', () => {
    const newDashInitial = {
      ...initial,
      version: 0,
    };
    const changed = {
      ...newDashInitial,
      version: 0,
    };

    const expectedChanges = {
      changedSaveModel: {
        ...newDashInitial,
      },
      initialSaveModel: {
        ...changed,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: false,
      isNew: true,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(newDashInitial, changed, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the time changes but they are not preserved', () => {
    const changed = {
      ...initial,
      time: {
        from: 'now-1d',
        to: 'now',
      },
    };

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...initial,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: true,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(initial, changed, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the time changes and they are preserved', () => {
    const changed = {
      ...initial,
      time: {
        from: 'now-1d',
        to: 'now',
      },
    };

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...changed,
      },
      diffs: {
        time: [
          {
            endLineNumber: expect.any(Number),
            op: 'replace',
            originalValue: 'now-7d',
            path: ['time', 'from'],
            startLineNumber: expect.any(Number),
            value: 'now-1d',
          },
        ],
      },
      diffCount: 1,
      hasChanges: true,
      hasTimeChanges: true,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(initial, changed, true, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the refresh changes but it is not preserved', () => {
    const changed = {
      ...initial,
      refresh: '2h',
    };

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...initial,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: true,
    };

    const result = getRawDashboardChanges(initial, changed, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the refresh changes and it is preserved', () => {
    const changed = {
      ...initial,
      refresh: '2h',
    };

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...changed,
      },
      diffs: {
        refresh: [
          {
            endLineNumber: expect.any(Number),
            op: 'replace',
            originalValue: '1h',
            path: ['refresh'],
            startLineNumber: expect.any(Number),
            value: '2h',
          },
        ],
      },
      diffCount: 1,
      hasChanges: true,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: true,
    };

    const result = getRawDashboardChanges(initial, changed, false, false, true);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the variable value changes but it is not preserved', () => {
    const changed = {
      ...initial,
      templating: {
        list: [
          {
            name: 'var1',
            type: 'query',
            query: 'query1',
            current: {
              value: 'value2',
              text: 'text1',
            },
            options: [],
          },
        ],
      },
    } as Dashboard;

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...initial,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: true,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(initial, changed, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should not see any changes on modified textbox var when we do not update variable values', () => {
    const newDashboard: Dashboard = {
      ...initial,
      templating: {
        list: [
          {
            name: 'var1',
            type: 'textbox',
            query: '',
            current: {
              value: 'value1',
              text: 'text1',
            },
            options: [],
          },
        ],
      },
    };

    const changedDashboard: Dashboard = {
      ...newDashboard,
      templating: {
        list: [
          {
            name: 'var1',
            type: 'textbox',
            query: 'query',
            current: {
              value: 'value1',
              text: 'text1',
            },
            options: [],
          },
        ],
      },
    };

    const expectedChanges = {
      initialSaveModel: {
        ...newDashboard,
      },
      changedSaveModel: {
        ...changedDashboard,
      },
      diffs: {},
      diffCount: 0,
      hasChanges: false,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(newDashboard, changedDashboard, false, false, false);

    expect(result).toEqual(expectedChanges);
  });

  it('should return the correct result when the variable value changes', () => {
    const changed = {
      ...initial,
      templating: {
        list: [
          {
            name: 'var1',
            type: 'query',
            query: 'query1',
            current: {
              value: 'value2',
              text: 'text1',
            },
            options: [],
          },
        ],
      },
    } as Dashboard;

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...changed,
      },
      diffs: {
        templating: [
          {
            endLineNumber: 17,
            op: 'replace',
            originalValue: 'value1',
            path: ['templating', 'list', '0', 'current', 'value'],
            startLineNumber: 17,
            value: 'value2',
          },
        ],
      },
      diffCount: 1,
      hasChanges: true,
      hasTimeChanges: false,
      isNew: false,
      hasVariableValueChanges: true,
      hasRefreshChange: false,
    };

    const result = getRawDashboardChanges(initial, changed, false, true, false);

    expect(result).toEqual(expectedChanges);
  });
});

describe('getDashboardChanges with adHocFilterDefaultValues', () => {
  const makeDashboardWithAdhoc = (filters: AdHocVariableFilter[]): Dashboard => {
    return {
      id: 1,
      title: 'Dashboard',
      time: { from: 'now-7d', to: 'now' },
      refresh: '1h',
      version: 1,
      schemaVersion: 1,
      templating: {
        list: [{ name: 'adhoc0', type: 'adhoc', filters } as unknown as VariableModel],
      },
    };
  };

  afterEach(() => {
    config.featureToggles.adHocFilterDefaultValues = false;
  });

  describe('when feature flag is enabled', () => {
    beforeEach(() => {
      config.featureToggles.adHocFilterDefaultValues = true;
    });

    it('should not report variable value changes when only origin filters differ', () => {
      const initial = makeDashboardWithAdhoc([]);
      const changed = makeDashboardWithAdhoc([{ key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' }]);

      const result = getRawDashboardChanges(initial, changed, false, false, false);

      expect(result.hasVariableValueChanges).toBe(false);
    });

    it('should report variable value changes when runtime filters differ', () => {
      const initial = makeDashboardWithAdhoc([]);
      const changed = makeDashboardWithAdhoc([{ key: 'host', operator: '=', value: 'localhost' }]);

      const result = getRawDashboardChanges(initial, changed, false, false, false);

      expect(result.hasVariableValueChanges).toBe(true);
    });

    it('should keep both origin and runtime filters when saveVariables is true', () => {
      const initial = makeDashboardWithAdhoc([]);
      const changed = makeDashboardWithAdhoc([
        { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);

      getRawDashboardChanges(initial, changed, false, true, false);

      const savedFilters = (changed.templating!.list![0] as AdHocVariableModel).filters;
      expect(savedFilters).toEqual([
        { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);
    });

    it('should preserve origin filters and restore runtime filters when saveVariables is false', () => {
      const initial = makeDashboardWithAdhoc([{ key: 'env', operator: '=', value: 'prod' }]);
      const changed = makeDashboardWithAdhoc([
        { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'staging' },
      ]);

      getRawDashboardChanges(initial, changed, false, false, false);

      const savedFilters = (changed.templating!.list![0] as AdHocVariableModel).filters;
      expect(savedFilters).toEqual([
        { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);
    });

    it('should detect schema changes when origin filters are added', () => {
      const initial = makeDashboardWithAdhoc([]);
      const changed = makeDashboardWithAdhoc([{ key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' }]);

      const result = getRawDashboardChanges(initial, changed, false, false, false);

      expect(result.hasVariableValueChanges).toBe(false);
      expect(result.hasChanges).toBe(true);
    });

    it('should detect schema changes when origin filters are removed', () => {
      const initial = makeDashboardWithAdhoc([{ key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' }]);
      const changed = makeDashboardWithAdhoc([]);

      const result = getRawDashboardChanges(initial, changed, false, false, false);

      expect(result.hasVariableValueChanges).toBe(false);
      expect(result.hasChanges).toBe(true);
    });
  });

  describe('when feature flag is disabled', () => {
    beforeEach(() => {
      config.featureToggles.adHocFilterDefaultValues = false;
    });

    it('should not report variable value changes when only origin filters differ', () => {
      const initial = makeDashboardWithAdhoc([]);
      const changed = makeDashboardWithAdhoc([{ key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' }]);

      const result = getRawDashboardChanges(initial, changed, false, false, false);

      expect(result.hasVariableValueChanges).toBe(false);
    });

    it('should reset all filters when saveVariables is false', () => {
      const initial = makeDashboardWithAdhoc([{ key: 'a', operator: '=', value: '1' }]);
      const changed = makeDashboardWithAdhoc([
        { key: 'a', operator: '=', value: '1' },
        { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
      ]);

      getRawDashboardChanges(initial, changed, false, false, false);

      const savedFilters = (changed.templating!.list![0] as AdHocVariableModel).filters;
      expect(savedFilters).toEqual([{ key: 'a', operator: '=', value: '1' }]);
    });
  });
});

describe('getRawDashboardV2Changes - section variables', () => {
  const makeSectionVariable = (value: string): VariableKind => ({
    kind: 'CustomVariable',
    spec: {
      name: 'env',
      label: 'Environment',
      query: 'dev,prod',
      current: { text: value, value },
      options: [{ text: value, value, selected: true }],
      multi: false,
      includeAll: false,
      hide: 'dontHide',
      skipUrlSync: false,
      allowCustomValue: false,
    },
  });

  const getCurrentValue = (variables?: VariableKind[]): string | undefined => {
    const v = variables?.[0];
    if (v?.kind === 'CustomVariable') {
      return v.spec.current?.value?.toString();
    }
    return undefined;
  };

  const makeV2Dashboard = (sectionValue: string): DashboardV2Spec => ({
    title: 'Dashboard V2',
    description: '',
    cursorSync: 'Crosshair',
    editable: true,
    links: [],
    tags: [],
    preload: false,
    liveNow: false,
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      autoRefresh: '5m',
      autoRefreshIntervals: [],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
    },
    variables: [],
    elements: {},
    annotations: [],
    layout: {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row with vars',
              collapse: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              variables: [makeSectionVariable(sectionValue)],
            },
          },
        ],
      },
    },
  });

  it('restores section variable defaults when saveVariables is false', () => {
    const initial = makeV2Dashboard('dev');
    const changed = makeV2Dashboard('prod');

    const result = getRawDashboardV2Changes(initial, changed, false, false, false);

    const row =
      result.changedSaveModel.layout.kind === 'RowsLayout' ? result.changedSaveModel.layout.spec.rows[0] : undefined;
    expect(getCurrentValue(row?.spec.variables)).toBe('dev');
    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(false);
  });

  it('persists section variable defaults when saveVariables is true', () => {
    const initial = makeV2Dashboard('dev');
    const changed = makeV2Dashboard('prod');

    const result = getRawDashboardV2Changes(initial, changed, false, true, false);

    const row =
      result.changedSaveModel.layout.kind === 'RowsLayout' ? result.changedSaveModel.layout.spec.rows[0] : undefined;
    expect(getCurrentValue(row?.spec.variables)).toBe('prod');
    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(true);
  });

  it('restores nested section variable defaults when saveVariables is false', () => {
    const makeNested = (value: string): DashboardV2Spec => ({
      title: 'Nested Dashboard',
      description: '',
      cursorSync: 'Crosshair',
      editable: true,
      links: [],
      tags: [],
      preload: false,
      liveNow: false,
      timeSettings: {
        from: 'now-6h',
        to: 'now',
        autoRefresh: '5m',
        autoRefreshIntervals: [],
        hideTimepicker: false,
        fiscalYearStartMonth: 0,
      },
      variables: [],
      elements: {},
      annotations: [],
      layout: {
        kind: 'TabsLayout',
        spec: {
          tabs: [
            {
              kind: 'TabsLayoutTab',
              spec: {
                title: 'Main',
                layout: {
                  kind: 'RowsLayout',
                  spec: {
                    rows: [
                      {
                        kind: 'RowsLayoutRow',
                        spec: {
                          title: 'Nested Row',
                          collapse: false,
                          layout: { kind: 'GridLayout', spec: { items: [] } },
                          variables: [makeSectionVariable(value)],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    });

    const initial = makeNested('dev');
    const changed = makeNested('prod');

    const result = getRawDashboardV2Changes(initial, changed, false, false, false);
    const tab =
      result.changedSaveModel.layout.kind === 'TabsLayout' ? result.changedSaveModel.layout.spec.tabs[0] : undefined;
    const row = tab?.spec.layout.kind === 'RowsLayout' ? tab.spec.layout.spec.rows[0] : undefined;

    expect(getCurrentValue(row?.spec.variables)).toBe('dev');
    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(false);
  });
});
