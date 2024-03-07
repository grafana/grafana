import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';

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

  const [labelWithUrl, setLabelWithUrl] = useState('');
  const [urlForLabel, setUrlForLabel] = useState('');
  const [isUsingUrl, setIsUsingUrl] = useState(false);


  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (onLabelClick) {
        if(isUsingUrl) {
          window.location.href = urlForLabel;
        } else { onLabelClick(item, event); }
      }
    },
    [item, onLabelClick, isUsingUrl, urlForLabel]
  );
  console.log(item);
  //item.url = item.label.split();
  useEffect(() => {
    const regex = /\[([^\]]+)\]\((.*?)\)/;
    const match = item.label.match(regex);
    setIsUsingUrl(match ? true : false);
    console.log("isUsingUrl", isUsingUrl);
    if (isUsingUrl) {
      setLabelWithUrl(match[1]);
      setUrlForLabel(match[2]);
      console.log("deconstructed url", labelWithUrl, urlForLabel);
    }
  }, [item.label, isUsingUrl, labelWithUrl, urlForLabel]);

  return (
    <div
      className={cx(styles.itemWrapper, item.disabled && styles.itemDisabled, className)}
      data-testid={selectors.components.VizLegend.seriesName(item.label)}
    >
      <VizLegendSeriesIcon seriesName={item.label} color={item.color} gradient={item.gradient} readonly={readonly} />
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
        {isUsingUrl ? labelWithUrl : item.label}
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
