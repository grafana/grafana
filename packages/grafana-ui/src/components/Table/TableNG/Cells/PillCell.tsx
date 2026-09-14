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

import { getTagColorsFromName } from '../../../../utils/tags';
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
          const { background, text } = getPillColors(display, renderedValue, field, theme, getTextColorForBackground);
          return {
            value: renderedValue,
            key: `${pill}-${index}`,
            bgColor: background,
            color: text,
          };
        })
      : [];
  }, [value, field, theme, getTextColorForBackground]);

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

// FIXME: this does not yet support "shades of a color"
function getPillColors(
  display: DisplayValue,
  value: string,
  field: Field,
  theme: GrafanaTheme2,
  getTextColorForBackground: (color: string) => string
): { background: string; text: string } {
  const cfg = field.config;
  const onBackground = (background: string) => ({ background, text: getTextColorForBackground(background) });

  if (cfg.mappings?.length) {
    return onBackground(display.color ?? FALLBACK_COLOR);
  }

  if (cfg.color?.mode === FieldColorModeId.Fixed) {
    return onBackground(theme.visualization.getColorByName(cfg.color.fixedColor ?? FALLBACK_COLOR));
  }

  // Only a mode that carries a categorical palette can color pills. Modes that don't — thresholds,
  // which every table field gets by default, and the continuous scales — leave the choice to us.
  const mode = cfg.color && fieldColorModeRegistry.get(cfg.color.mode);
  if (typeof mode?.getColors === 'function') {
    return onBackground(getColorByStringHash(mode.getColors(theme), value));
  }

  // Under the visual refresh the pills fall in with the refreshed tags, which take a background and
  // a matching same-hue text color from the theme's tag palette — a pair `getTextColorForBackground`
  // cannot derive, since it only ever answers with near-black or near-white. The hash is the one
  // tags use, so a value reads the same color here as it does in any other tag across the UI.
  if (theme.flags.visualDesignRefresh) {
    const { background, text } = getTagColorsFromName(value, theme);
    return { background, text };
  }

  return onBackground(getColorByStringHash(classicColors, value));
}

export const getStyles: TableCellStyles = memoize(
  (theme, { textWrap, shouldOverflow, maxHeight }) =>
    css({
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      flexWrap: textWrap ? 'wrap' : 'nowrap',

      ...(shouldOverflow && {
        [getActiveCellSelector(Boolean(maxHeight))]: {
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
