import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useMemo } from 'react';

import {
  GrafanaTheme2,
  isDataFrame,
  classicColors,
  colorManipulator,
  Field,
  getColorByStringHash,
} from '@grafana/data';
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
    const pillValues = inferPills(value);
    return createPills(pillValues, field);
  }, [value, field]);

  return (
    <>
      {pills.map((pill) => (
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
      ))}
    </>
  );
}

// todo: pills can only string, boolean, enum, (maybe int)
export function inferPills(value: string): string[] {
  if (value === '') {
    return [];
  }

  // json array
  if (value[0] === '[') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // JSON array of strings
        return parsed
          .filter((item) => item != null && item !== '')
          .map(String)
          .map((text) => text.trim())
          .filter((item) => item !== '');
      }
    } catch {
      // Not valid JSON, continue with other parsing
    }
  } else {
    return value.split(',');
  }
}

function getPillColor(value: string, field: Field): string {
  const cfg = field.config;

  if (cfg.mappings?.length ?? 0 > 0) {
    return field.display!(value).color ?? DEFAULT_PILL_BG_COLOR;
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return cfg.color?.fixedColor ?? DEFAULT_PILL_BG_COLOR;
  }

  // TODO: instead of classicColors is wrong, we need to pull colors from theme, same way as FieldColorModeId.PaletteClassicByName
  // see fieldColor.ts
  return getColorByStringHash(classicColors, value);
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    display: 'inline-block',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    minWidth: 'fit-content',
  }),
});
