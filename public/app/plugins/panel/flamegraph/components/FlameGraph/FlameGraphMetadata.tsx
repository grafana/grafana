import { css } from '@emotion/css';
import React from 'react';

import { createTheme, Field, getDisplayProcessor, Vector } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Metadata, SampleUnit } from '../types';

import { ItemWithStart } from './dataTransform';

type Props = {
  levels: ItemWithStart[][];
  topLevelIndex: number;
  selectedBarIndex: number;
  valueField: Field<number, Vector<number>>;
  totalTicks: number;
};

const FlameGraphMetadata = React.memo(({ levels, topLevelIndex, selectedBarIndex, valueField, totalTicks }: Props) => {
  const styles = useStyles2(getStyles);
  if (levels[topLevelIndex] && levels[topLevelIndex][selectedBarIndex]) {
    const bar = levels[topLevelIndex][selectedBarIndex];
    const metadata = getMetadata(valueField, bar.value, totalTicks);
    const metadataText = `${metadata?.unitValue} (${metadata?.percentValue}%) of ${metadata?.samples} total samples (${metadata?.unitTitle})`;
    return <>{<div className={styles.metadata}>{metadataText}</div>}</>;
  }
  return <></>;
});

export const getMetadata = (field: Field, value: number, totalTicks: number): Metadata => {
  let unitTitle;
  const processor = getDisplayProcessor({ field, theme: createTheme() /* theme does not matter for us here */ });
  const displayValue = processor(value);
  const percentValue = Math.round(10000 * (value / totalTicks)) / 100;
  let unitValue = displayValue.text + displayValue.suffix;

  switch (field.config.unit) {
    case SampleUnit.Bytes:
      unitTitle = 'RAM';
      break;
    case SampleUnit.Nanoseconds:
      unitTitle = 'Time';
      break;
    default:
      unitTitle = 'Count';
      if (!displayValue.suffix) {
        // Makes sure we don't show 123undefined or something like that if suffix isn't defined
        unitValue = displayValue.text;
      }
      break;
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
