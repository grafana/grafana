import React from 'react';

import { BigValueTextMode } from '@grafana/schema';

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
