import { useMemo } from 'react';

import {
  GrafanaTheme2,
  classicColors,
  colorManipulator,
  Field,
  getColorByStringHash,
  FALLBACK_COLOR,
  fieldColorModeRegistry,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { PillCellProps, TableCellValue } from '../types';

export function PillCell({ rowIdx, field, theme }: PillCellProps) {
  const value = field.values[rowIdx];
  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return pillValues.length > 0 ? createPills(pillValues, field, theme) : [];
  }, [value, field, theme]);

  if (pills.length === 0) {
    return null;
  }

  return pills.map((pill) => (
    <span
      className="pill"
      key={pill.key}
      style={{
        backgroundColor: pill.bgColor,
        color: pill.color,
        border: pill.bgColor === TRANSPARENT ? `1px solid ${theme.colors.border.strong}` : undefined,
      }}
    >
      {pill.value}
    </span>
  ));
}

interface Pill {
  value: string;
  key: string;
  bgColor: string;
  color: string;
}

const SPLIT_RE = /\s*,\s*/;
const TRANSPARENT = 'rgba(0,0,0,0)';

function createPills(pillValues: string[], field: Field, theme: GrafanaTheme2): Pill[] {
  return pillValues.map((pill, index) => {
    const bgColor = getPillColor(pill, field, theme);
    const textColor = colorManipulator.getContrastRatio('#FFFFFF', bgColor) >= 4.5 ? '#FFFFFF' : '#000000';
    return {
      value: pill,
      key: `${pill}-${index}`,
      bgColor,
      color: textColor,
    };
  });
}

export function inferPills(rawValue: TableCellValue): string[] {
  if (rawValue === '' || rawValue == null) {
    return [];
  }

  const value = String(rawValue);

  if (value[0] === '[') {
    try {
      return JSON.parse(value);
    } catch {
      return value.trim().split(SPLIT_RE);
    }
  }

  return value.trim().split(SPLIT_RE);
}

// FIXME: this does not yet support "shades of a color"
function getPillColor(value: string, field: Field, theme: GrafanaTheme2): string {
  const cfg = field.config;

  if (cfg.mappings?.length ?? 0 > 0) {
    return field.display!(value).color ?? FALLBACK_COLOR;
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return theme.visualization.getColorByName(cfg.color?.fixedColor ?? FALLBACK_COLOR);
  }

  let colors = classicColors;
  const configuredColor = cfg.color;
  if (configuredColor) {
    const mode = fieldColorModeRegistry.get(configuredColor.mode);
    if (typeof mode?.getColors === 'function') {
      colors = mode.getColors(theme);
    }
  }

  return getColorByStringHash(colors, value);
}
