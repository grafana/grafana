import { css } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { Metadata } from '../types';

import { FlameGraphDataContainer, LevelItem } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  levels: LevelItem[][];
  topLevelIndex: number;
  selectedBarIndex: number;
  totalTicks: number;
};

const FlameGraphMetadata = React.memo(({ data, levels, topLevelIndex, selectedBarIndex, totalTicks }: Props) => {
  const styles = useStyles2(getStyles);
  if (levels[topLevelIndex] && levels[topLevelIndex][selectedBarIndex]) {
    const bar = levels[topLevelIndex][selectedBarIndex];
    const metadata = getMetadata(data, bar, totalTicks);
    const metadataText = `${metadata?.unitValue} (${metadata?.percentValue}%) of ${metadata?.samples} total samples (${metadata?.unitTitle})`;
    return <>{<div className={styles.metadata}>{metadataText}</div>}</>;
  }
  return <></>;
});

export const getMetadata = (data: FlameGraphDataContainer, bar: LevelItem, totalTicks: number): Metadata => {
  const displayValue = data.getValueDisplay(bar.itemIndex);
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
