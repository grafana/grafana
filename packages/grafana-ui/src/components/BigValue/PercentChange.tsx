import React from 'react';

import { BigValueTextMode } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';

export interface Props {
  percentChange: number | undefined;
  percentChangeStyles: React.CSSProperties;
  panelStyles: React.CSSProperties;
  valueAndTitleContainerFlexDirection: string | undefined;
  valueFontSize: number;
  textMode: BigValueTextMode | undefined;
}

export const PercentChange = ({
  percentChange,
  percentChangeStyles,
  panelStyles,
  valueAndTitleContainerFlexDirection,
  valueFontSize,
  textMode,
}: Props) => {
  const percentChangeString =
    percentChange?.toLocaleString(undefined, { style: 'percent', maximumSignificantDigits: 3 }) ?? '';
  const percentChangeIcon =
    percentChange && (percentChange > 0 ? 'arrow-up' : percentChange < 0 ? 'arrow-down' : undefined);

  const metricHeight = valueFontSize;
  const metricAlignment = panelStyles.flexDirection === 'row' ? 'center' : 'flex-start';
  const iconDim = metricHeight / 2;

  const percentChangeNaN = Number.isNaN(percentChange) || percentChange === undefined;
  const showPercentChange = !percentChangeNaN && textMode !== BigValueTextMode.None;

  if (showPercentChange && valueAndTitleContainerFlexDirection === 'column') {
    percentChangeStyles.marginTop = -iconDim / 4;
  }

  const theme = useTheme2();
  // set percent change color based on value, 0 is neutral and should be theme text color
  if (percentChange && percentChange > 0) {
    percentChangeStyles.color = '#73bf68';
  } else if (percentChange && percentChange < 0) {
    percentChangeStyles.color = '#f2485c';
  } else {
    // This edge case has not yet been tested and may need to be adjusted
    percentChangeStyles.color = theme.colors.primary.text;
  }

  // Adding text shadow to percent change to make it more readable when background does not contrast well
  percentChangeStyles.textShadow = '1px 1px 0px black';

  return (
    showPercentChange && (
      <div style={percentChangeStyles}>
        <HorizontalGroup height={metricHeight} align={metricAlignment}>
          {percentChangeIcon && <Icon name={percentChangeIcon} height={iconDim} width={iconDim} viewBox="6 6 12 12" />}
          {percentChangeString}
        </HorizontalGroup>
      </div>
    )
  );
};
