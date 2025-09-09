import { Action as ActionV1, ActionType, HttpRequestMethod } from '@grafana/data';
import {
  defaultVariableHide,
  defaultVariableSort,
  defaultVariableRefresh,
  defaultDashboardCursorSync,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import {
  transformCursorSynctoEnum,
  transformVariableRefreshToEnum,
  transformVariableHideToEnum,
  transformSortVariableToEnum,
  transformActionsV2,
} from './transformToV2TypesUtils';

describe('transformToV2TypesUtils', () => {
  describe('transformCursorSynctoEnum', () => {
    it('should return the correct enum value for cursor sync', () => {
      expect(transformCursorSynctoEnum(0)).toBe('Off');
      expect(transformCursorSynctoEnum(1)).toBe('Crosshair');
      expect(transformCursorSynctoEnum(2)).toBe('Tooltip');
      expect(transformCursorSynctoEnum(undefined)).toBe(defaultDashboardCursorSync());
    });
  });
});

describe('transformVariableRefreshToEnum', () => {
  it('should return the correct enum value for variable refresh', () => {
    expect(transformVariableRefreshToEnum(0)).toBe('never');
    expect(transformVariableRefreshToEnum(1)).toBe('onDashboardLoad');
    expect(transformVariableRefreshToEnum(2)).toBe('onTimeRangeChanged');
    expect(transformVariableRefreshToEnum(undefined)).toBe(defaultVariableRefresh());
  });
});

describe('transformVariableHideToEnum', () => {
  it('should return the correct enum value for variable hide', () => {
    expect(transformVariableHideToEnum(0)).toBe('dontHide');
    expect(transformVariableHideToEnum(1)).toBe('hideLabel');
    expect(transformVariableHideToEnum(2)).toBe('hideVariable');
    expect(transformVariableHideToEnum(undefined)).toBe(defaultVariableHide());
  });
});

describe('transformSortVariableToEnum', () => {
  it('should return the correct enum value for variable sort', () => {
    expect(transformSortVariableToEnum(0)).toBe('disabled');
    expect(transformSortVariableToEnum(1)).toBe('alphabeticalAsc');
    expect(transformSortVariableToEnum(2)).toBe('alphabeticalDesc');
    expect(transformSortVariableToEnum(3)).toBe('numericalAsc');
    expect(transformSortVariableToEnum(4)).toBe('numericalDesc');
    expect(transformSortVariableToEnum(undefined)).toBe(defaultVariableSort());
  });
});

describe('transformActionsV2', () => {
  it('should return undefined for empty or null actions', () => {
    expect(transformActionsV2([])).toBeUndefined();
    expect(transformActionsV2(null as unknown as ActionV1[])).toBeUndefined();
    expect(transformActionsV2(undefined as unknown as ActionV1[])).toBeUndefined();
  });

  it('should transform actions with fetch configuration', () => {
    const mockActions: ActionV1[] = [
      {
        type: ActionType.Fetch,
        title: 'Test Fetch Action',
        fetch: {
          method: HttpRequestMethod.POST,
          url: 'https://api.example.com/data',
          body: '{"test": true}',
          headers: [
            ['Content-Type', 'application/json'],
            ['Authorization', 'Bearer token'],
          ],
          queryParams: [
            ['param1', 'value1'],
            ['param2', 'value2'],
          ],
        },
        confirmation: 'Are you sure?',
        oneClick: true,
      },
    ];

    const result = transformActionsV2(mockActions);

    expect(result).toBeDefined();
    expect(result!).toHaveLength(1);
    expect(result![0]).toMatchObject({
      type: ActionType.Fetch,
      title: 'Test Fetch Action',
      confirmation: 'Are you sure?',
      oneClick: true,
      fetch: {
        method: HttpRequestMethod.POST,
        url: 'https://api.example.com/data',
        body: '{"test": true}',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        queryParams: { param1: 'value1', param2: 'value2' },
      },
    });
  });

  it('should transform actions with infinity configuration', () => {
    const mockActions: ActionV1[] = [
      {
        type: ActionType.Infinity,
        title: 'Test Infinity Action',
        infinity: {
          method: HttpRequestMethod.GET,
          url: 'https://infinity.example.com/data',
          datasourceUid: 'infinity-uid',
          headers: [['Accept', 'application/json']],
          queryParams: [['filter', 'active']],
        },
      },
    ];

    const result = transformActionsV2(mockActions);

    expect(result).toBeDefined();
    expect(result!).toHaveLength(1);
    expect(result![0]).toMatchObject({
      type: ActionType.Infinity,
      title: 'Test Infinity Action',
      infinity: {
        method: HttpRequestMethod.GET,
        url: 'https://infinity.example.com/data',
        datasourceUid: 'infinity-uid',
        headers: { Accept: 'application/json' },
        queryParams: { filter: 'active' },
      },
    });
  });

  it('should handle actions without headers or queryParams', () => {
    const mockActions: ActionV1[] = [
      {
        type: ActionType.Fetch,
        title: 'Simple Action',
        fetch: {
          method: HttpRequestMethod.GET,
          url: 'https://api.example.com/simple',
        },
      },
    ];

    const result = transformActionsV2(mockActions);

    expect(result).toBeDefined();
    expect(result!).toHaveLength(1);
    expect(result![0].fetch).toMatchObject({
      method: HttpRequestMethod.GET,
      url: 'https://api.example.com/simple',
    });
  });

  it('should transform multiple actions', () => {
    const mockActions: ActionV1[] = [
      {
        type: ActionType.Fetch,
        title: 'Action 1',
        fetch: {
          method: HttpRequestMethod.POST,
          url: 'https://api.example.com/action1',
        },
      },
      {
        type: ActionType.Infinity,
        title: 'Action 2',
        infinity: {
          method: HttpRequestMethod.GET,
          url: 'https://infinity.example.com/action2',
          datasourceUid: 'infinity-uid',
        },
      },
    ];

    const result = transformActionsV2(mockActions);

    expect(result).toBeDefined();
    expect(result!).toHaveLength(2);
    expect(result![0].title).toBe('Action 1');
    expect(result![1].title).toBe('Action 2');
  });
});
