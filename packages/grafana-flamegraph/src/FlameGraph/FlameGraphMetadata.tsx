import { css } from '@emotion/css';
import { memo, type ReactNode } from 'react';

import { getValueFormat, type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Tooltip, useStyles2 } from '@grafana/ui';

import { type ClickedItemData } from '../types';
import { getProfilePercentage } from '../utils';

import { type FlameGraphDataContainer } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  // Whole-profile total. Sandwich view rescales bars to the selected function, so `totalTicks` is that
  // function's value and cannot be used as the denominator for "% of total".
  totalProfileTicks: number;
  onFocusPillClick: () => void;
  onSandwichPillClick: () => void;
  focusedItem?: ClickedItemData;
  sandwichedLabel?: string;
};

const FlameGraphMetadata = memo(
  ({
    data,
    focusedItem,
    totalTicks,
    totalProfileTicks,
    sandwichedLabel,
    onFocusPillClick,
    onSandwichPillClick,
  }: Props) => {
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
      const percentValue = getProfilePercentage({ value: totalTicks, total: totalProfileTicks });

      parts.push(
        <Tooltip key={'sandwich'} content={sandwichedLabel} placement="top">
          <div>
            <Icon size={'sm'} name={'angle-right'} />
            <div className={styles.metadataPill}>
              <Icon size={'sm'} name={'gf-show-context'} />
              &nbsp;{percentValue}% of total
              <IconButton
                className={styles.pillCloseButton}
                name={'times'}
                size={'sm'}
                onClick={onSandwichPillClick}
                tooltip={'Remove sandwich view'}
                aria-label={'Remove sandwich view'}
              />
            </div>
          </div>
        </Tooltip>
      );
    }

    if (focusedItem) {
      const percentValue = getProfilePercentage({ value: focusedItem.item.value, total: totalTicks });
      const iconName = percentValue > 0 ? 'eye' : 'exclamation-circle';

      parts.push(
        <Tooltip key={'focus'} content={focusedItem.label} placement="top">
          <div>
            <Icon size={'sm'} name={'angle-right'} />
            <div className={styles.metadataPill}>
              <Icon size={'sm'} name={iconName} />
              &nbsp;{percentValue}% of total
              <IconButton
                className={styles.pillCloseButton}
                name={'times'}
                size={'sm'}
                onClick={onFocusPillClick}
                tooltip={'Remove focus'}
                aria-label={'Remove focus'}
              />
            </div>
          </div>
        </Tooltip>
      );
    }

    return <div className={styles.metadata}>{parts}</div>;
  }
);

FlameGraphMetadata.displayName = 'FlameGraphMetadata';

const getStyles = (theme: GrafanaTheme2) => ({
  metadataPill: css({
    label: 'metadataPill',
    display: 'inline-flex',
    alignItems: 'center',
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.sm,
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: theme.typography.bodySmall.lineHeight,
    color: theme.colors.text.secondary,
  }),
  pillCloseButton: css({
    label: 'pillCloseButton',
    verticalAlign: 'text-bottom',
    margin: theme.spacing(0, 0.5),
  }),
  metadata: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '8px 0',
  }),
});

export default FlameGraphMetadata;
