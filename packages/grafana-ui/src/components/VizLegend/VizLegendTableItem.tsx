import { css, cx } from '@emotion/css';
import { useCallback } from 'react';
import * as React from 'react';

import { formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type LegendOverflow } from '@grafana/schema';

import { useStyles2 } from '../../themes/ThemeContext';
import { hoverColor } from '../../themes/mixins';

import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { type VizLegendItem } from './types';

export interface Props {
  key?: React.Key;
  item: VizLegendItem;
  className?: string;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLButtonElement>) => void;
  onLabelMouseOver?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
  onLabelMouseOut?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
  readonly?: boolean;
  hasMixedAxes?: boolean;
  overflow?: LegendOverflow;
}

/**
 * @internal
 */
export const LegendTableItem = ({
  item,
  onLabelClick,
  onLabelMouseOver,
  onLabelMouseOut,
  className,
  readonly,
  hasMixedAxes,
  overflow,
}: Props) => {
  const styles = useStyles2(getStyles, overflow);

  const onMouseOver = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FocusEvent<HTMLButtonElement>) => {
      if (onLabelMouseOver) {
        onLabelMouseOver(item, event);
      }
    },
    [item, onLabelMouseOver]
  );

  const onMouseOut = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FocusEvent<HTMLButtonElement>) => {
      if (onLabelMouseOut) {
        onLabelMouseOut(item, event);
      }
    },
    [item, onLabelMouseOut]
  );

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (onLabelClick) {
        onLabelClick(item, event);
      }
    },
    [item, onLabelClick]
  );

  return (
    <tr className={cx(styles.row, className)}>
      <td>
        <VizLegendSeriesIcon
          color={item.color}
          seriesName={item.fieldName ?? item.label}
          readonly={readonly}
          lineStyle={item.lineStyle}
        />
      </td>
      <td className={styles.name}>
        <button
          disabled={readonly}
          type="button"
          title={item.label}
          onBlur={onMouseOut}
          onFocus={onMouseOver}
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
          onClick={!readonly ? onClick : undefined}
          className={cx(styles.label, item.disabled && styles.labelDisabled)}
        >
          {item.label}{' '}
          {item.yAxis === 2 && hasMixedAxes && (
            <span className={styles.yAxisLabel}>
              <Trans i18nKey="grafana-ui.viz-legend.right-axis-indicator">(right y-axis)</Trans>
            </span>
          )}
        </button>
      </td>
      {item.getDisplayValues &&
        item.getDisplayValues().map((stat, index) => {
          return <td key={`${stat.title}-${index}`}>{formattedValueToString(stat)}</td>;
        })}
    </tr>
  );
};

LegendTableItem.displayName = 'LegendTableItem';

const getStyles = (theme: GrafanaTheme2, overflow?: LegendOverflow) => {
  const rowHoverBg = hoverColor(theme.colors.background.primary, theme);

  return {
    row: css({
      label: 'LegendRow',

      '&:hover': {
        background: rowHoverBg,
      },
    }),
    label: css({
      label: 'LegendLabel',
      background: 'none',
      border: 'none',
      fontSize: 'inherit',
      padding: 0,
      width: '100%',

      textOverflow: 'ellipsis',
      whiteSpace: overflow === 'wrap' ? 'normal' : 'nowrap',

      overflow: 'hidden',
      userSelect: 'text',
      textAlign: 'left',
      overflowWrap: 'break-word',
    }),
    labelDisabled: css({
      label: 'LegendLabelDisabled',
      color: theme.colors.text.disabled,
    }),
    name: css({
      textAlign: 'left',
    }),
    yAxisLabel: css({
      color: theme.colors.text.secondary,
    }),
  };
};
