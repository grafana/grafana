import { css } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { Metadata } from '../types';

import { FlameGraphDataContainer } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  focusedItemIndex?: number;
};

const FlameGraphMetadata = React.memo(({ data, focusedItemIndex, totalTicks }: Props) => {
  const styles = useStyles2(getStyles);
  const metadata = getMetadata(data, focusedItemIndex || 0, totalTicks);
  const metadataText = `${metadata?.unitValue} (${metadata?.percentValue}%) of ${metadata?.samples} total samples (${metadata?.unitTitle})`;
  return <>{<div className={styles.metadata}>{metadataText}</div>}</>;
});

export const getMetadata = (data: FlameGraphDataContainer, itemIndex: number, totalTicks: number): Metadata => {
  const displayValue = data.getValueDisplay(itemIndex);
  const percentValue = Math.round(10000 * (displayValue.numeric / totalTicks)) / 100;
  let unitValue = displayValue.text + displayValue.suffix;

  const unitTitle = data.getUnitTitle();
  if (unitTitle === 'Count') {
    if (!displayValue.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitValue = displayValue.text;
    }
  }

  return {
    percentValue,
    unitTitle,
    unitValue,
    samples: totalTicks.toLocaleString(),
  };
};

FlameGraphMetadata.displayName = 'FlameGraphMetadata';

const getStyles = () => ({
  metadata: css`
    margin: 8px 0;
    text-align: center;
  `,
});

export default FlameGraphMetadata;
