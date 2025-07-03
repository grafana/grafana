import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useMemo } from 'react';

import { GrafanaTheme2, isDataFrame, classicColors, colorManipulator } from '@grafana/data';
import { TablePillCellOptions } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableCellRendererProps } from '../types';

export function PillCell({ value, field, justifyContent, cellOptions }: TableCellRendererProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const pills = useMemo(() => {
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
  }, [value]);

  if (pills.length === 0) {
    return <div className={styles.cell}>-</div>;
  }

  return (
    <div className={styles.cell}>
      <div className={styles.pillsContainer}>
        {pills.map((pill, index) => {
          const bgColor = getPillColor(pill, cellOptions);
          const textColor = colorManipulator.getContrastRatio('#FFFFFF', bgColor) >= 4.5 ? '#FFFFFF' : '#000000';

          return (
            <span
              key={`${pill}-${index}`}
              className={styles.pill}
              style={{
                backgroundColor: bgColor,
                color: textColor,
              }}
            >
              {pill}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function isPillCellOptions(cellOptions: TableCellRendererProps['cellOptions']): cellOptions is TablePillCellOptions {
  return cellOptions?.type === 'pill';
}

function getPillColor(pill: string, cellOptions: TableCellRendererProps['cellOptions']): string {
  if (!isPillCellOptions(cellOptions)) {
    return getDeterministicColor(pill);
  }

  const colorMode = cellOptions.colorMode || 'auto';

  // Fixed color mode (highest priority)
  if (colorMode === 'fixed' && cellOptions.color) {
    // If it's a hex color, use it directly; otherwise check if it's a valid named color
    if (cellOptions.color.startsWith('#')) {
      return cellOptions.color;
    } else {
    }
  }

  // Mapped color mode - use valueMappings to assign colors
  if (colorMode === 'mapped' && cellOptions.valueMappings) {
    const mapping = cellOptions.valueMappings.find(m => {
      const matchType = m.matchType || 'exact';
      if (matchType === 'exact') {
        return m.value === pill;
      } else if (matchType === 'contains') {
        return pill.includes(m.value);
      }
      return false;
    });
    if (mapping && mapping.color) {
      return mapping.color;
    }
    // Fallback to default color for unmapped values
    return cellOptions.color || '#FF780A';
  }

  // Auto mode - deterministic color assignment based on string hash
  if (colorMode === 'auto') {
    return getDeterministicColor(pill);
  }

  // Default color for unknown values or fallback
  return '#FF780A';
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
