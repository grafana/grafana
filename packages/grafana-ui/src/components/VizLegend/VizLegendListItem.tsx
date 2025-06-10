import { css, cx } from '@emotion/css';
import { useCallback } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendStatsList } from './VizLegendStatsList';
import { VizLegendItem } from './types';

export interface Props<T> {
  item: VizLegendItem<T>;
  className?: string;
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLButtonElement>) => void;
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
export const VizLegendListItem = <T = unknown,>({
  item,
  onLabelClick,
  onLabelMouseOver,
  onLabelMouseOut,
  className,
  readonly,
}: Props<T>) => {
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
    <div
      className={cx(styles.itemWrapper, item.disabled && styles.itemDisabled, className)}
      data-testid={selectors.components.VizLegend.seriesName(item.label)}
    >
      <VizLegendSeriesIcon
        seriesName={item.fieldName ?? item.label}
        color={item.color}
        gradient={item.gradient}
        readonly={readonly}
        lineStyle={item.lineStyle}
      />
      <button
        disabled={readonly}
        type="button"
        onBlur={onMouseOut}
        onFocus={onMouseOver}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onClick={onClick}
        className={styles.label}
      >
        {item.label}
      </button>

      {item.getDisplayValues && <VizLegendStatsList stats={item.getDisplayValues()} />}
    </div>
  );
};

VizLegendListItem.displayName = 'VizLegendListItem';

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    label: 'LegendLabel',
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    fontSize: 'inherit',
    padding: 0,
    userSelect: 'text',
  }),
  itemDisabled: css({
    label: 'LegendLabelDisabled',
    color: theme.colors.text.disabled,
  }),
  itemWrapper: css({
    label: 'LegendItemWrapper',
    display: 'flex',
    whiteSpace: 'nowrap',
    alignItems: 'center',
    flexGrow: 1,
  }),
  value: css({
    textAlign: 'right',
  }),
  yAxisLabel: css({
    color: theme.v1.palette.gray2,
  }),
});
