import { css } from '@emotion/css';
import React from 'react';

import { createTheme, Field, getDisplayProcessor } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Metadata, SampleUnit } from '../types';

type Props = {
  metadata: Metadata;
};

const FlameGraphMetadata = ({ metadata }: Props) => {
  const styles = useStyles2(getStyles);
  const metadataText = `${metadata?.unitValue} (${metadata?.percentValue}%) of ${metadata?.samples} total samples (${metadata?.unitTitle})`;

  return <>{metadata && <div className={styles.metadata}>{metadataText}</div>}</>;
};

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

const getStyles = () => ({
  metadata: css`
    margin: 8px 0;
    text-align: center;
  `,
});

export default FlameGraphMetadata;
