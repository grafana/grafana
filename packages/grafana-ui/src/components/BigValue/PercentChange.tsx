import React from 'react';

import { Icon } from '../Icon/Icon';

import { PercentChangeStyles } from './BigValueLayout';

export interface Props {
  percentChange: number;
  styles: PercentChangeStyles;
}

export const PercentChange = ({ percentChange, styles }: Props) => {
  const percentChangeString =
    percentChange?.toLocaleString(undefined, { style: 'percent', maximumSignificantDigits: 3 }) ?? '';
  const percentChangeIcon =
    percentChange && (percentChange > 0 ? 'arrow-up' : percentChange < 0 ? 'arrow-down' : undefined);

  // Add text shadow to percent change to make it more readable when background does not contrast well
  //const shadowDim = metricHeight / 60;
  //const shadowString = `${shadowDim}px ${shadowDim}px ${shadowDim}px black`;
  //percentChangeStyles.textShadow = shadowString;

  return (
    <div style={styles.containerStyles}>
      {percentChangeIcon && (
        <Icon
          name={percentChangeIcon}
          height={styles.iconSize}
          width={styles.iconSize}
          viewBox="6 6 12 12"
          //filter={`drop-shadow(${shadowString})`}
        />
      )}
      {percentChangeString}
    </div>
  );
};
