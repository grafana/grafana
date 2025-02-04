import { Dashboard, Panel } from '@grafana/schema';

import { adHocVariableFiltersEqual, getRawDashboardChanges, getPanelChanges } from './getDashboardChanges';

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

describe('getPanelChanges', () => {
  const initial: Panel = {
    id: 1,
    type: 'graph',
    title: 'Panel 1',
    gridPos: {
      x: 0,
      y: 0,
      w: 12,
      h: 8,
    },
    targets: [
      {
        refId: 'A',
        query: 'query1',
      },
    ],
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
    };

    expect(getPanelChanges(initial, changed)).toEqual(expectedChanges);
  });

  it('should return the correct result when there is some changes', () => {
    const changed = {
      ...initial,
      title: 'Panel 2',
      type: 'table',
      gridPos: {
        ...initial.gridPos,
        x: 1,
      },
      targets: [
        {
          refId: 'A',
          query: 'query2',
        },
      ],
    } as Panel;

    const expectedChanges = {
      initialSaveModel: {
        ...initial,
      },
      changedSaveModel: {
        ...changed,
      },
      diffs: {
        title: [
          {
            endLineNumber: 3,
            op: 'replace',
            originalValue: 'Panel 1',
            path: ['title'],
            startLineNumber: 3,
            value: 'Panel 2',
          },
        ],
        type: [
          {
            endLineNumber: 2,
            op: 'replace',
            originalValue: 'graph',
            path: ['type'],
            startLineNumber: 2,
            value: 'table',
          },
        ],
        gridPos: [
          {
            endLineNumber: 5,
            op: 'replace',
            originalValue: 0,
            path: ['gridPos', 'x'],
            startLineNumber: 5,
            value: 1,
          },
        ],
        targets: [
          {
            endLineNumber: 13,
            op: 'replace',
            originalValue: 'query1',
            path: ['targets', '0', 'query'],
            startLineNumber: 13,
            value: 'query2',
          },
        ],
      },
      diffCount: 4,
      hasChanges: true,
    };

    expect(getPanelChanges(changed, initial)).toEqual(expectedChanges);
  });
});
