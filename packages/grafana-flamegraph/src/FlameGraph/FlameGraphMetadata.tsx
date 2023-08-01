import { css } from '@emotion/css';
import React, { ReactNode } from 'react';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data/src';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { ClickedItemData } from '../types';

import { FlameGraphDataContainer } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  onFocusPillClick: () => void;
  onSandwichPillClick: () => void;
  focusedItem?: ClickedItemData;
  sandwichedLabel?: string;
};

const FlameGraphMetadata = React.memo(
  ({ data, focusedItem, totalTicks, sandwichedLabel, onFocusPillClick, onSandwichPillClick }: Props) => {
    const styles = useStyles2(getStyles);
    const parts: ReactNode[] = [];
    const ticksVal = getValueFormat('short')(totalTicks);

    const displayValue = data.valueDisplayProcessor(totalTicks);
    let unitValue = displayValue.text + displayValue.suffix;
    const unitTitle = data.getUnitTitle();
    if (unitTitle === 'Count') {
      if (!displayValue.suffix) {
        // Makes sure we don't show 123undefined or something like that if suffix isn't defined
        unitValue = displayValue.text;
      }
    }

    parts.push(
      <div className={styles.metadataPill} key={'default'}>
        {unitValue} | {ticksVal.text}
        {ticksVal.suffix} samples ({unitTitle})
      </div>
    );

    if (sandwichedLabel) {
      parts.push(
        <span key={'sandwich'}>
          <Icon size={'sm'} name={'angle-right'} />
          <div className={styles.metadataPill}>
            <Icon size={'sm'} name={'gf-show-context'} />{' '}
            {sandwichedLabel.substring(sandwichedLabel.lastIndexOf('/') + 1)}
            <IconButton
              className={styles.pillCloseButton}
              name={'times'}
              size={'sm'}
              onClick={onSandwichPillClick}
              tooltip={'Remove sandwich view'}
              aria-label={'Remove sandwich view'}
            />
          </div>
        </span>
      );
    }

    if (focusedItem) {
      const percentValue = Math.round(10000 * (focusedItem.item.value / totalTicks)) / 100;
      parts.push(
        <span key={'focus'}>
          <Icon size={'sm'} name={'angle-right'} />
          <div className={styles.metadataPill}>
            <Icon size={'sm'} name={'eye'} /> {percentValue}% of total
            <IconButton
              className={styles.pillCloseButton}
              name={'times'}
              size={'sm'}
              onClick={onFocusPillClick}
              tooltip={'Remove focus'}
              aria-label={'Remove focus'}
            />
          </div>
        </span>
      );
    }

    return <>{<div className={styles.metadata}>{parts}</div>}</>;
  }
);

FlameGraphMetadata.displayName = 'FlameGraphMetadata';

const getStyles = (theme: GrafanaTheme2) => ({
  metadataPill: css`
    label: metadataPill;
    display: inline-block;
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius(8)};
    padding: ${theme.spacing(0.5, 1)};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    line-height: ${theme.typography.bodySmall.lineHeight};
    color: ${theme.colors.text.secondary};
  `,

  pillCloseButton: css`
    label: pillCloseButton;
    vertical-align: text-bottom;
    margin: ${theme.spacing(0, 0.5)};
  `,
  metadata: css`
    margin: 8px 0;
    text-align: center;
  `,
});

export default FlameGraphMetadata;
