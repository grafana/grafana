import { css } from '@emotion/css';
import React, { ReactNode } from 'react';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data/src';
import { FilterPill, Icon, useStyles2 } from '@grafana/ui';

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
    // const metadata = getMetadata(data, totalTicks, theme);
    // const metadataText = `${metadata.unitValue} (${metadata?.percentValue}%) of ${metadata?.samples} total samples (${metadata?.unitTitle})`;

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
      <FilterPill
        className={styles.pill}
        label={`${unitValue} of ${ticksVal.text}${ticksVal.suffix} samples (${unitTitle})`}
        selected={false}
        onClick={() => {}}
      />
    );

    if (sandwichedLabel) {
      parts.push(
        <>
          {' > '}
          <FilterPill
            className={styles.pill}
            label={
              <>
                <Icon containerClassName={styles.pillIcon} size={'sm'} name={'gf-show-context'} />{' '}
                {sandwichedLabel.substring(sandwichedLabel.lastIndexOf('/'))}
              </>
            }
            selected={false}
            tooltip={'Remove sandwich view'}
            onClick={onSandwichPillClick}
          />
        </>
      );
    }

    if (focusedItem) {
      const percentValue = Math.round(10000 * (focusedItem.item.value / totalTicks)) / 100;
      parts.push(
        <>
          {' > '}
          <FilterPill
            className={styles.pill}
            label={
              <>
                <Icon containerClassName={styles.pillIcon} size={'sm'} name={'eye'} /> {percentValue}% of total
              </>
            }
            selected={false}
            onClick={onFocusPillClick}
            tooltip={'Remove focus'}
          />
        </>
      );
    }

    return <>{<div className={styles.metadata}>{parts}</div>}</>;
  }
);

// export const getMetadata = (
//   data: FlameGraphDataContainer,
//   value: number,
//   totalTicks: number,
//   theme: GrafanaTheme2
// ): Metadata => {
//   const displayValue = data.valueDisplayProcessor(value);
//   const percentValue = Math.round(10000 * (displayValue.numeric / totalTicks)) / 100;
//   let unitValue = displayValue.text + displayValue.suffix;
//
//   return {
//     percentValue,
//     unitTitle,
//     unitValue,
//     samples: ticksVal.text,
//   };
// };

FlameGraphMetadata.displayName = 'FlameGraphMetadata';

const getStyles = (theme: GrafanaTheme2) => ({
  metadata: css`
    margin: 8px 0;
    text-align: center;
  `,
  pill: css`
    label: pill;
    display: inline-block;
    height: 24px;
    padding: ${theme.spacing(0, 1)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,

  pillIcon: css`
    label: pill;
    vertical-align: text-bottom;
  `,
});

export default FlameGraphMetadata;
