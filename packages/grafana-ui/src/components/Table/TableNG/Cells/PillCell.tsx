import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, classicColors, colorManipulator, Field, getColorByStringHash } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableCellRendererProps } from '../types';

const DEFAULT_PILL_BG_COLOR = '#FF780A';

interface Pill {
  value: string;
  key: string;
  bgColor: string;
  color: string;
}

function createPills(pillValues: string[], field: Field): Pill[] {
  return pillValues.map((pill, index) => {
    const bgColor = getPillColor(pill, field);
    const textColor = colorManipulator.getContrastRatio('#FFFFFF', bgColor) >= 4.5 ? '#FFFFFF' : '#000000';
    return {
      value: pill,
      key: `${pill}-${index}`,
      bgColor,
      color: textColor,
    };
  });
}

export function PillCell({ value, field }: TableCellRendererProps) {
  const styles = useStyles2(getStyles);

  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(String(value));
    return createPills(pillValues, field);
  }, [value, field]);

  return pills.map((pill) => (
    <span
      key={pill.key}
      className={styles.pill}
      style={{
        backgroundColor: pill.bgColor,
        color: pill.color,
      }}
    >
      {pill.value}
    </span>
  ));
}

const SPLIT_RE = /\s*,\s*/;

export function inferPills(value: string): string[] {
  if (value === '') {
    return [];
  }

  if (value[0] === '[') {
    try {
      return JSON.parse(value);
    } catch {
      return value.trim().split(SPLIT_RE);
    }
  }

  return value.trim().split(SPLIT_RE);
}

function getPillColor(value: string, field: Field): string {
  const cfg = field.config;

  if (cfg.mappings?.length ?? 0 > 0) {
    return field.display!(value).color ?? DEFAULT_PILL_BG_COLOR;
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return cfg.color?.fixedColor ?? DEFAULT_PILL_BG_COLOR;
  }

  // TODO: instead of classicColors we need to pull colors from theme, same way as FieldColorModeId.PaletteClassicByName (see fieldColor.ts)
  return getColorByStringHash(classicColors, value);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    display: 'inline-block',
    padding: theme.spacing(0.25, 0.75),
    marginInlineEnd: theme.spacing(0.5),
    marginBlock: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    whiteSpace: 'nowrap',
  }),
});
