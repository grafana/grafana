import { css } from '@emotion/css';
import { memo, ReactNode } from 'react';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data';
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

const FlameGraphMetadata = memo(
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
            <span className={styles.metadataPillName}>
              {sandwichedLabel.substring(sandwichedLabel.lastIndexOf('/') + 1)}
            </span>
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
    borderRadius: theme.shape.borderRadius(8),
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
    margin: '8px 0',
    textAlign: 'center',
  }),
  metadataPillName: css({
    label: 'metadataPillName',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginLeft: theme.spacing(0.5),
  }),
});

export default FlameGraphMetadata;
