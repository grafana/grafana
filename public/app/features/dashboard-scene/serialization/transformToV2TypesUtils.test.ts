import {
  defaultVariableHide,
  defaultVariableSort,
  defaultVariableRefresh,
  defaultDashboardCursorSync,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import {
  transformCursorSynctoEnum,
  transformVariableRefreshToEnum,
  transformVariableHideToEnum,
  transformSortVariableToEnum,
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
