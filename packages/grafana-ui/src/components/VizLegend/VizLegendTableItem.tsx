import { css, cx } from '@emotion/css';
import { useCallback } from 'react';
import * as React from 'react';

import { formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { hoverColor } from '../../themes/mixins';

import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem } from './types';

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
}: Props) => {
  const styles = useStyles2(getStyles);

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
        <span className={styles.itemWrapper}>
          <VizLegendSeriesIcon
            color={item.color}
            seriesName={item.fieldName ?? item.label}
            readonly={readonly}
            lineStyle={item.lineStyle}
          />
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
            {item.yAxis === 2 && (
              <span className={styles.yAxisLabel}>
                <Trans i18nKey="grafana-ui.viz-legend.right-axis-indicator">(right y-axis)</Trans>
              </span>
            )}
          </button>
        </span>
      </td>
      {item.getDisplayValues &&
        item.getDisplayValues().map((stat, index) => {
          return (
            <td className={styles.value} key={`${stat.title}-${index}`}>
              {formattedValueToString(stat)}
            </td>
          );
        })}
    </tr>
  );
};

LegendTableItem.displayName = 'LegendTableItem';

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = hoverColor(theme.colors.background.primary, theme);

  return {
    row: css({
      label: 'LegendRow',
      fontSize: theme.v1.typography.size.sm,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      td: {
        padding: theme.spacing(0.25, 1),
        whiteSpace: 'nowrap',
      },

      '&:hover': {
        background: rowHoverBg,
      },
    }),
    label: css({
      label: 'LegendLabel',
      whiteSpace: 'nowrap',
      background: 'none',
      border: 'none',
      fontSize: 'inherit',
      padding: 0,
      maxWidth: '600px',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      userSelect: 'text',
    }),
    labelDisabled: css({
      label: 'LegendLabelDisabled',
      color: theme.colors.text.disabled,
    }),
    itemWrapper: css({
      display: 'flex',
      whiteSpace: 'nowrap',
      alignItems: 'center',
    }),
    value: css({
      textAlign: 'right',
    }),
    yAxisLabel: css({
      color: theme.colors.text.secondary,
    }),
  };
};
