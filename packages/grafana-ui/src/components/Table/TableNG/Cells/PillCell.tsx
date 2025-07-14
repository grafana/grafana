import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  GrafanaTheme2,
  classicColors,
  colorManipulator,
  Field,
  getColorByStringHash,
  FALLBACK_COLOR,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { PillCellProps, TableCellValue } from '../types';

interface Pill {
  value: string;
  key: string;
  bgColor: string;
  color: string;
}

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

export function PillCell({ rowIdx, field }: PillCellProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const value = field.values[rowIdx];

  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return pillValues.length > 0 ? createPills(pillValues, field, theme) : [];
  }, [value, field, theme]);

  if (pills.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={styles.pill}
          style={{
            backgroundColor: pill.bgColor,
            color: pill.color,
            border: pill.bgColor === TRANSPARENT ? `1px solid ${theme.colors.border.strong}` : undefined,
          }}
        >
          {pill.value}
        </span>
      ))}
    </div>
  );
}

const SPLIT_RE = /\s*,\s*/;
const TRANSPARENT = 'rgba(0,0,0,0)';

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

function getPillColor(value: string, field: Field, theme: GrafanaTheme2): string {
  const cfg = field.config;

  if (cfg.mappings?.length ?? 0 > 0) {
    return field.display!(value).color ?? FALLBACK_COLOR;
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return theme.visualization.getColorByName(cfg.color?.fixedColor ?? FALLBACK_COLOR);
  }

  // TODO: instead of classicColors we need to pull colors from theme, same way as FieldColorModeId.PaletteClassicByName (see fieldColor.ts)
  return getColorByStringHash(classicColors, value);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginBlockStart: theme.spacing(-0.25),
  }),
  pill: css({
    display: 'inline-block',
    padding: theme.spacing(0.25, 0.75),
    marginInlineEnd: theme.spacing(0.5),
    marginBlock: theme.spacing(0.25),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    whiteSpace: 'nowrap',
  }),
});
