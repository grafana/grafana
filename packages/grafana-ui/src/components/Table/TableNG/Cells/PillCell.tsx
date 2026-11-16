import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useMemo } from 'react';

import {
  type GrafanaTheme2,
  classicColors,
  type DisplayValue,
  type Field,
  FieldType,
  getColorByStringHash,
  getFieldColorModeForField,
  getFieldColorPalette,
  getScaleCalculator,
  getValueMappingResult,
  isNumeric,
  formattedValueToString,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { getTagColor, getTagColorsFromName } from '../../../../utils/tags';
import { Tag } from '../../../Tags/Tag';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type PillCellProps, type TableCellStyles } from '../types';
import { inferPills } from '../utils';

export function PillCell({ rowIdx, field, theme, getTextColorForBackground }: PillCellProps) {
  const value = field.values[rowIdx];
  const resolveColor = useMemo(
    () => createPillColorResolver(field, theme, getTextColorForBackground),
    [field, theme, getTextColorForBackground]
  );
  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return pillValues.length > 0
      ? pillValues.map((pill, index) => {
          // `display` resolves labels from the raw value. Color resolution also needs the raw value
          // so explicit mapping colors and numeric scales take precedence over categorical schemes.
          const display = field.display!(pill);
          const renderedValue = formattedValueToString(display);
          const { background, text } = resolveColor(pill, display, renderedValue);
          return {
            value: renderedValue,
            key: `${pill}-${index}`,
            bgColor: background,
            color: text,
          };
        })
      : [];
  }, [value, field, resolveColor]);

  if (pills.length === 0) {
    return null;
  }

  return pills.map((pill) => {
    // Pill colors are data-driven (value mappings, a fixed field color, or a hash over the palette),
    // so they override whatever the element's own styles paint.
    const style = {
      backgroundColor: pill.bgColor,
      color: pill.color,
      border: pill.bgColor === TRANSPARENT ? `1px solid ${theme.colors.border.strong}` : undefined,
    };

    // Under the visual refresh, pills are Tag components so they match the refreshed tags rendered
    // everywhere else. Tag brings the shape and typography; only the colors come from the data.
    return theme.flags.visualDesignRefresh ? (
      <Tag key={pill.key} name={pill.value} style={style} />
    ) : (
      <span key={pill.key} style={style}>
        {pill.value}
      </span>
    );
  });
}

interface Pill {
  value: string;
  key: string;
  bgColor: string;
  color: string;
}

const TRANSPARENT = 'rgba(0,0,0,0)';

function createPillColorResolver(
  field: Field,
  theme: GrafanaTheme2,
  getTextColorForBackground: (color: string) => string
): (rawValue: unknown, display: DisplayValue, value: string) => { background: string; text: string } {
  const cfg = field.config;
  const onBackground = (background: string) =>
    theme.flags.visualDesignRefresh
      ? getTagColor(background, theme)
      : { background, text: getTextColorForBackground(background) };
  const mode = cfg.color && getFieldColorModeForField(field);
  const hasMappings = Boolean(cfg.mappings?.length);
  const schemeScale =
    mode?.isByValue && mode.id !== FieldColorModeId.Thresholds ? getScaleCalculator(field, theme) : undefined;
  const thresholdScale =
    !hasMappings && mode?.id === FieldColorModeId.Thresholds ? getScaleCalculator(field, theme) : undefined;
  const palette = getFieldColorPalette(field, theme);

  const resolveBaseColor = (rawValue: unknown, display: DisplayValue, value: string) => {
    if (schemeScale && isNumeric(rawValue)) {
      return onBackground(schemeScale(Number(rawValue)).color);
    }

    if (palette?.length) {
      return onBackground(getColorByStringHash(palette, value));
    }

    if (field.type === FieldType.enum && display.color) {
      return onBackground(display.color);
    }

    if (theme.flags.visualDesignRefresh) {
      const { background, text } = getTagColorsFromName(value, theme);
      return { background, text };
    }

    return onBackground(getColorByStringHash(classicColors, value));
  };

  return (rawValue, display, value) => {
    if (hasMappings) {
      const mapping = getValueMappingResult(cfg.mappings!, rawValue);
      return mapping?.color
        ? onBackground(theme.visualization.getColorByName(mapping.color))
        : resolveBaseColor(rawValue, display, value);
    }

    if (thresholdScale && isNumeric(rawValue)) {
      return onBackground(thresholdScale(Number(rawValue)).color);
    }

    return resolveBaseColor(rawValue, display, value);
  };
}

export const getStyles: TableCellStyles = memoize(
  (theme, { textWrap, shouldOverflow, hoverOverflow, maxHeight }) =>
    css({
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      flexWrap: textWrap ? 'wrap' : 'nowrap',

      ...(shouldOverflow && {
        [getActiveCellSelector(Boolean(maxHeight), hoverOverflow)]: {
          flexWrap: 'wrap',
        },
      }),

      // Under the visual refresh the pills are Tags, which carry their own shape and typography.
      ...(!theme.flags.visualDesignRefresh && {
        '> span': {
          display: 'flex',
          padding: theme.spacing(0.25, 0.75),
          borderRadius: theme.shape.radius.default,
          fontSize: theme.typography.bodySmall.fontSize,
          lineHeight: theme.typography.bodySmall.lineHeight,
          whiteSpace: 'nowrap',
        },
      }),
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
