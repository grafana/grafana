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

import { getTagColor, getTagColorIndexFromName, getTransparentOutlineColor } from '../../../../utils/tags';
import { Tag } from '../../../Tags/Tag';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type PillCellProps, type TableCellStyles } from '../types';
import { inferPills } from '../utils';

export function PillCell({ rowIdx, field, theme, getTextColorForBackground }: PillCellProps) {
  const value = field.values[rowIdx];
  const resolveColor = useMemo(() => getPillColorResolver(field, theme), [field, theme]);
  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return pillValues.length > 0
      ? pillValues.map((pill, index) => {
          // `display` resolves labels from the raw value. Color resolution also needs the raw value
          // so explicit mapping colors and numeric scales take precedence over categorical schemes.
          const display = field.display!(pill);
          const renderedValue = formattedValueToString(display);
          return {
            value: renderedValue,
            key: `${pill}-${index}`,
            color: resolveColor(pill, display, renderedValue),
          };
        })
      : [];
  }, [value, field, resolveColor]);

  if (pills.length === 0) {
    return null;
  }

  return pills.map((pill) => {
    // Under the visual refresh, pills are Tag components so they match the refreshed tags rendered
    // everywhere else. Tag derives the colors from a data-driven base color or a palette index, so
    // every pill shares one class.
    if (theme.flags.visualDesignRefresh) {
      const outline =
        'baseColor' in pill.color
          ? {
              boxShadow: `inset 0 0 0 1px ${getTransparentOutlineColor(pill.color.baseColor, theme.colors.border.strong)}`,
            }
          : undefined;
      return <Tag key={pill.key} name={pill.value} {...pill.color} style={outline} />;
    }

    const { background, text } =
      'baseColor' in pill.color
        ? { background: pill.color.baseColor, text: getTextColorForBackground(pill.color.baseColor) }
        : getTagColor(pill.color.colorIndex, theme);
    const style = {
      backgroundColor: background,
      color: text,
      border: background === TRANSPARENT ? `1px solid ${theme.colors.border.strong}` : undefined,
    };

    return (
      <span key={pill.key} style={style}>
        {pill.value}
      </span>
    );
  });
}

/** A data-driven base color, or an index into the theme tag palette. */
type PillColor = { baseColor: string } | { colorIndex: number };

interface Pill {
  value: string;
  key: string;
  color: PillColor;
}

const TRANSPARENT = 'rgba(0,0,0,0)';

interface PillColorResolverCacheEntry {
  resolve: PillColorResolver;
  theme: GrafanaTheme2;
}

type PillColorResolver = (rawValue: unknown, display: DisplayValue, value: string) => PillColor;

const pillColorResolverCache = new WeakMap<Field, PillColorResolverCacheEntry>();

function getPillColorResolver(field: Field, theme: GrafanaTheme2): PillColorResolver {
  const cached = pillColorResolverCache.get(field);
  if (cached?.theme === theme) {
    return cached.resolve;
  }

  const resolve = createPillColorResolver(field, theme);
  pillColorResolverCache.set(field, { theme, resolve });
  return resolve;
}

function createPillColorResolver(field: Field, theme: GrafanaTheme2): PillColorResolver {
  const cfg = field.config;
  const onBackground = (baseColor: string): PillColor => ({ baseColor });
  const fromName = (name: string): PillColor => ({ colorIndex: getTagColorIndexFromName(name, theme) });
  const mode = cfg.color && getFieldColorModeForField(field);
  const hasMappings = Boolean(cfg.mappings?.length);
  const usesSchemeScale = mode?.isByValue && mode.id !== FieldColorModeId.Thresholds;
  const usesThresholdScale = !hasMappings && mode?.id === FieldColorModeId.Thresholds;
  const scaleField = usesSchemeScale || usesThresholdScale ? getPillScaleField(field) : field;
  const schemeScale = usesSchemeScale ? getScaleCalculator(scaleField, theme) : undefined;
  const thresholdScale = usesThresholdScale ? getScaleCalculator(scaleField, theme) : undefined;
  const palette = getFieldColorPalette(field, theme);
  const mappingColors = hasMappings ? new Map<unknown, string | undefined>() : undefined;

  const resolveBaseColor = (rawValue: unknown, display: DisplayValue, value: string) => {
    if (schemeScale && isNumeric(rawValue)) {
      return onBackground(schemeScale(Number(rawValue)).color);
    }

    if (theme.flags.visualDesignRefresh) {
      if (cfg.color?.mode === FieldColorModeId.PaletteClassicByName) {
        return fromName(field.name);
      }

      if (cfg.color?.mode === FieldColorModeId.PaletteClassic || cfg.color?.mode === FieldColorModeId.Thresholds) {
        return fromName(value);
      }
    }

    if (palette?.length) {
      const colorName = mode?.useSeriesName ? field.name : value;
      return onBackground(getColorByStringHash(palette, colorName));
    }

    if (field.type === FieldType.enum && display.color) {
      return onBackground(display.color);
    }

    if (theme.flags.visualDesignRefresh) {
      return fromName(value);
    }

    return onBackground(getColorByStringHash(classicColors, value));
  };

  return (rawValue, display, value) => {
    if (mappingColors) {
      let mappingColor = mappingColors.get(rawValue);
      if (!mappingColors.has(rawValue)) {
        mappingColor = getValueMappingResult(cfg.mappings!, rawValue)?.color;
        mappingColors.set(rawValue, mappingColor);
      }

      return mappingColor
        ? onBackground(theme.visualization.getColorByName(mappingColor))
        : resolveBaseColor(rawValue, display, value);
    }

    if (thresholdScale && isNumeric(rawValue)) {
      return onBackground(thresholdScale(Number(rawValue)).color);
    }

    return resolveBaseColor(rawValue, display, value);
  };
}

function getPillScaleField(field: Field): Field {
  if (field.type === FieldType.number) {
    return field;
  }

  const values: number[] = [];
  for (const value of field.values) {
    for (const pill of inferPills(value)) {
      if (isNumeric(pill)) {
        values.push(Number(pill));
      }
    }
  }

  return {
    ...field,
    type: FieldType.number,
    values,
    state: field.state ? { ...field.state, range: undefined } : undefined,
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
