import { DashboardLink as DashboardLinkTypeV1 } from '@grafana/schema';
import {
  DashboardCursorSync,
  DashboardLinkType,
  VariableRefresh,
  VariableHide,
  VariableSort,
  defaultVariableHide,
  defaultVariableSort,
  defaultVariableRefresh,
  defaultDashboardLinkType,
  defaultDashboardCursorSync,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

import {
  transformCursorSynctoEnum,
  transformDashboardLinksToEnums,
  transformVariableRefreshToEnum,
  transformVariableHideToEnum,
  transformSortVariableToEnum,
} from './transformToV2TypesUtils';

describe('transformToV2TypesUtils', () => {
  describe('transformCursorSynctoEnum', () => {
    it('should return the correct enum value for cursor sync', () => {
      expect(transformCursorSynctoEnum(0)).toBe(DashboardCursorSync.Off);
      expect(transformCursorSynctoEnum(1)).toBe(DashboardCursorSync.Crosshair);
      expect(transformCursorSynctoEnum(2)).toBe(DashboardCursorSync.Tooltip);
      expect(transformCursorSynctoEnum(undefined)).toBe(defaultDashboardCursorSync());
    });
  });

  describe('transformDashboardLinksToEnums', () => {
    const links: DashboardLinkTypeV1[] = [
      {
        type: 'link',
        asDropdown: false,
        icon: '',
        includeVars: false,
        keepTime: false,
        tags: [],
        title: '',
        url: '',
        targetBlank: false,
        tooltip: '',
      },
      {
        type: 'dashboards',
        asDropdown: false,
        icon: '',
        includeVars: false,
        keepTime: false,
        tags: [],
        title: '',
        url: '',
        targetBlank: false,
        tooltip: '',
      },
      {
        // @ts-expect-error Testing invalid type
        type: 'non-valid-type',
        asDropdown: false,
        icon: '',
        includeVars: false,
        keepTime: false,
        tags: [],
        title: '',
        url: '',
        targetBlank: false,
        tooltip: '',
      },
    ];

    const transformedLinks = transformDashboardLinksToEnums(links);
    expect(transformedLinks[0].type).toBe(DashboardLinkType.Link);
    expect(transformedLinks[1].type).toBe(DashboardLinkType.Dashboards);
    expect(transformedLinks[2].type).toBe(defaultDashboardLinkType());
  });
});

describe('transformVariableRefreshToEnum', () => {
  it('should return the correct enum value for variable refresh', () => {
    expect(transformVariableRefreshToEnum(0)).toBe(VariableRefresh.Never);
    expect(transformVariableRefreshToEnum(1)).toBe(VariableRefresh.OnDashboardLoad);
    expect(transformVariableRefreshToEnum(2)).toBe(VariableRefresh.OnTimeRangeChanged);
    expect(transformVariableRefreshToEnum(undefined)).toBe(defaultVariableRefresh());
  });
});

describe('transformVariableHideToEnum', () => {
  it('should return the correct enum value for variable hide', () => {
    expect(transformVariableHideToEnum(0)).toBe(VariableHide.DontHide);
    expect(transformVariableHideToEnum(1)).toBe(VariableHide.HideLabel);
    expect(transformVariableHideToEnum(2)).toBe(VariableHide.HideVariable);
    expect(transformVariableHideToEnum(undefined)).toBe(defaultVariableHide());
  });
});

describe('transformSortVariableToEnum', () => {
  it('should return the correct enum value for variable sort', () => {
    expect(transformSortVariableToEnum(0)).toBe(VariableSort.Disabled);
    expect(transformSortVariableToEnum(1)).toBe(VariableSort.AlphabeticalAsc);
    expect(transformSortVariableToEnum(2)).toBe(VariableSort.AlphabeticalDesc);
    expect(transformSortVariableToEnum(3)).toBe(VariableSort.NumericalAsc);
    expect(transformSortVariableToEnum(4)).toBe(VariableSort.NumericalDesc);
    expect(transformSortVariableToEnum(undefined)).toBe(defaultVariableSort());
  });
});
