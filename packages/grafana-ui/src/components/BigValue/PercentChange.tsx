import React from 'react';

import { Icon } from '../Icon/Icon';

import { PercentChangeStyles } from './BigValueLayout';

export interface Props {
  percentChange: number;
  styles: PercentChangeStyles;
}

export const PercentChange = ({ percentChange, styles }: Props) => {
  const percentChangeIcon =
    percentChange && (percentChange > 0 ? 'arrow-up' : percentChange < 0 ? 'arrow-down' : undefined);

  return (
    <div style={styles.containerStyles}>
      {percentChangeIcon && (
        <Icon name={percentChangeIcon} height={styles.iconSize} width={styles.iconSize} viewBox="6 6 12 12" />
      )}
      {percentChangeString(percentChange)}
    </div>
  );
};

export const percentChangeString = (percentChange: number) => {
  return percentChange?.toLocaleString(undefined, { style: 'percent', maximumSignificantDigits: 3 }) ?? '';
};
