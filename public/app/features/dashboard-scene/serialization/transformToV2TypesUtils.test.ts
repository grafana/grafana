import { FieldColorModeId } from '@grafana/schema';
import {
  defaultVariableHide,
  defaultVariableSort,
  defaultVariableRefresh,
  defaultDashboardCursorSync,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  transformCursorSynctoEnum,
  transformVariableRefreshToEnum,
  transformVariableHideToEnum,
  transformSortVariableToEnum,
  colorIdEnumToColorIdV2,
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
      expect(transformSortVariableToEnum(5)).toBe('alphabeticalCaseInsensitiveAsc');
      expect(transformSortVariableToEnum(6)).toBe('alphabeticalCaseInsensitiveDesc');
      expect(transformSortVariableToEnum(7)).toBe('naturalAsc');
      expect(transformSortVariableToEnum(8)).toBe('naturalDesc');
      expect(transformSortVariableToEnum(undefined)).toBe(defaultVariableSort());
    });
  });

  describe('colorIdEnumToColorIdV2', () => {
    it('should map known color modes to their v2 equivalents', () => {
      expect(colorIdEnumToColorIdV2(FieldColorModeId.Thresholds)).toBe('thresholds');
      expect(colorIdEnumToColorIdV2(FieldColorModeId.PaletteClassic)).toBe('palette-classic');
      expect(colorIdEnumToColorIdV2(FieldColorModeId.PaletteClassicByName)).toBe('palette-classic-by-name');
      expect(colorIdEnumToColorIdV2(FieldColorModeId.Fixed)).toBe('fixed');
    });

    // Regression: the colorblind-safe palette and gradient mode were silently dropped on
    // save because they had no mapping here, so the converted mode was undefined and the
    // color was removed.
    it('should preserve the colorblind-safe palette', () => {
      expect(colorIdEnumToColorIdV2('palette-colorblind')).toBe('palette-colorblind');
    });

    it('should preserve the gradient color mode', () => {
      expect(colorIdEnumToColorIdV2('gradient')).toBe('gradient');
    });

    it('should return undefined for unknown color modes', () => {
      expect(colorIdEnumToColorIdV2('not-a-real-mode')).toBeUndefined();
    });
  });
});
