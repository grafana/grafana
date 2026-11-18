import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useMemo } from 'react';

import {
  type GrafanaTheme2,
  classicColors,
  type DisplayValue,
  type Field,
  getColorByStringHash,
  FALLBACK_COLOR,
  fieldColorModeRegistry,
  formattedValueToString,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { getTransparentOutlineColor } from '../../../../utils/tags';
import { Tag } from '../../../Tags/Tag';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type PillCellProps, type TableCellStyles } from '../types';
import { inferPills } from '../utils';

export function PillCell({ rowIdx, field, theme, getTextColorForBackground }: PillCellProps) {
  const value = field.values[rowIdx];
  const pills: Pill[] = useMemo(() => {
    const pillValues = inferPills(value);
    return pillValues.length > 0
      ? pillValues.map((pill, index) => {
          // `display` resolves the value mappings, so it has to see the raw value, and its result
          // carries both the label and the mapped color — call it once and use both.
          const display = field.display!(pill);
          const renderedValue = formattedValueToString(display);
          return {
            value: renderedValue,
            key: `${pill}-${index}`,
            baseColor: getPillBaseColor(display, renderedValue, field, theme),
          };
        })
      : [];
  }, [value, field, theme]);

  if (pills.length === 0) {
    return null;
  }

  return pills.map((pill) => {
    // Under the visual refresh, pills are Tag components so they match the refreshed tags rendered
    // everywhere else. Tag derives the text color, and without a base color it hashes the value
    // over the theme tag palette.
    if (theme.flags.visualDesignRefresh) {
      const outline =
        pill.baseColor !== undefined
          ? { boxShadow: `inset 0 0 0 1px ${getTransparentOutlineColor(pill.baseColor, theme.colors.border.strong)}` }
          : undefined;
      return <Tag key={pill.key} name={pill.value} baseColor={pill.baseColor} style={outline} />;
    }

    const background = pill.baseColor ?? getColorByStringHash(classicColors, pill.value);
    const style = {
      backgroundColor: background,
      color: getTextColorForBackground(background),
      border: background === TRANSPARENT ? `1px solid ${theme.colors.border.strong}` : undefined,
    };

    return (
      <span key={pill.key} style={style}>
        {pill.value}
      </span>
    );
  });
}

interface Pill {
  value: string;
  key: string;
  /** Data-driven pill color; undefined leaves the choice to the palette for the active theme. */
  baseColor?: string;
}

const TRANSPARENT = 'rgba(0,0,0,0)';

// FIXME: this does not yet support "shades of a color"
function getPillBaseColor(
  display: DisplayValue,
  value: string,
  field: Field,
  theme: GrafanaTheme2
): string | undefined {
  const cfg = field.config;

  if (cfg.mappings?.length) {
    return display.color ?? FALLBACK_COLOR;
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return theme.visualization.getColorByName(cfg.color.fixedColor ?? FALLBACK_COLOR);
  }

  // Only a mode that carries a categorical palette can color pills. Modes that don't — thresholds,
  // which every table field gets by default, and the continuous scales — leave the choice to us.
  const mode = cfg.color && fieldColorModeRegistry.get(cfg.color.mode);
  if (typeof mode?.getColors === 'function') {
    return getColorByStringHash(mode.getColors(theme), value);
  }

  return undefined;
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
