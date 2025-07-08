import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useMemo } from 'react';

import { GrafanaTheme2, isDataFrame, classicColors, colorManipulator, Field } from '@grafana/data';
import { TablePillCellOptions } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableCellRendererProps } from '../types';

const DEFAULT_PILL_BG_COLOR = '#FF780A';

interface Pill {
  value: string;
  key: string;
  bgColor: string;
  color: string;
}

function createPills(pillValues: string[], cellOptions: TableCellRendererProps['cellOptions'], field: Field): Pill[] {
  return pillValues.map((pill, index) => {
    const bgColor = getPillColor(pill, cellOptions, field);
    const textColor = colorManipulator.getContrastRatio('#FFFFFF', bgColor) >= 4.5 ? '#FFFFFF' : '#000000';
    return {
      value: pill,
      key: `${pill}-${index}`,
      bgColor,
      color: textColor,
    };
  });
}

export function PillCell({ value, field, justifyContent, cellOptions }: TableCellRendererProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return createPills(pillValues, cellOptions, field);
  }, [value, cellOptions, field]);

  if (pills.length === 0) {
    return <div className={styles.cell}>-</div>;
  }

  return (
    <div className={styles.cell}>
      <div className={styles.pillsContainer}>
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
      </div>
    </div>
  );
}

export function inferPills(value: unknown): string[] {
  if (!value) {
    return [];
  }

  // Handle DataFrame - not supported for pills
  if (isDataFrame(value)) {
    return [];
  }

  // Handle different value types
  const stringValue = String(value);

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(stringValue);
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

  // Handle CSV string
  if (stringValue.includes(',')) {
    return stringValue
      .split(',')
      .map((text) => text.trim())
      .filter((item) => item !== '');
  }

  // Single value - strip quotes
  return [stringValue.replace(/["'`]/g, '').trim()];
}

function isPillCellOptions(cellOptions: TableCellRendererProps['cellOptions']): cellOptions is TablePillCellOptions {
  return cellOptions?.type === 'pill';
}

function getPillColor(pill: string, cellOptions: TableCellRendererProps['cellOptions'], field: Field): string {
  if (!isPillCellOptions(cellOptions)) {
    return getDeterministicColor(pill);
  }

  const colorMode = cellOptions.colorMode || 'auto';

  // Fixed color mode (highest priority)
  if (colorMode === 'fixed' && cellOptions.color) {
    return cellOptions.color;
  }

  // Mapped color mode - use field's value mappings
  if (colorMode === 'mapped') {
    // Check if field has value mappings
    if (field.config.mappings && field.config.mappings.length > 0) {
      // Use the field's display processor to get the mapped value
      const displayValue = field.display!(pill);
      if (displayValue.color) {
        return displayValue.color;
      }
    }
    // Fallback to default color for unmapped values
    return cellOptions.color || DEFAULT_PILL_BG_COLOR;
  }

  // Auto mode - deterministic color assignment based on string hash
  if (colorMode === 'auto') {
    return getDeterministicColor(pill);
  }

  // Default color for unknown values or fallback
  return DEFAULT_PILL_BG_COLOR;
}

function getDeterministicColor(text: string): string {
  // Create a simple hash of the string to get consistent colors
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get a consistent index
  const colorValues = Object.values(classicColors);
  const index = Math.abs(hash) % colorValues.length;

  return colorValues[index];
}

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent | undefined) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent || 'flex-start',
    alignItems: 'center',
    height: '100%',
    padding: theme.spacing(0.5),
  }),
  pillsContainer: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    maxWidth: '100%',
  }),
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
