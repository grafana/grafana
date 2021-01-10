import React from 'react';
import { css, cx } from 'emotion';
import { LegendSeriesIcon } from './LegendSeriesIcon';
import { LegendItem, SeriesAxisToggleHandler } from './types';
import { SeriesColorChangeHandler } from './types';
import { LegendStatsList } from './LegendStatsList';
import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

export interface Props {
  item: LegendItem;
  className?: string;
  onLabelClick?: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
}

export const LegendListItem: React.FunctionComponent<Props> = ({
  item,
  onSeriesColorChange,
  onSeriesAxisToggle,
  onLabelClick,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      <LegendSeriesIcon
        disabled={!onSeriesColorChange}
        color={item.color}
        onColorChange={color => {
          if (onSeriesColorChange) {
            onSeriesColorChange(item.label, color);
          }
        }}
        onToggleAxis={() => {
          if (onSeriesAxisToggle) {
            onSeriesAxisToggle(item.label, item.yAxis === 1 ? 2 : 1);
          }
        }}
        yAxis={item.yAxis}
      />
      <div
        onClick={event => {
          if (onLabelClick) {
            onLabelClick(item, event);
          }
        }}
        className={cx(styles.label, item.disabled && styles.labelDisabled)}
      >
        {item.label}
      </div>

      {item.displayValues && <LegendStatsList stats={item.displayValues} />}
    </>
  );
};

LegendListItem.displayName = 'LegendTableItem';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    label: css`
      label: LegendLabel;
      cursor: pointer;
      white-space: nowrap;
    `,
    labelDisabled: css`
      label: LegendLabelDisabled;
      color: ${theme.colors.linkDisabled};
    `,
    itemWrapper: css`
      display: flex;
      white-space: nowrap;
    `,
    value: css`
      text-align: right;
    `,
    yAxisLabel: css`
      color: ${theme.palette.gray2};
    `,
  };
});
