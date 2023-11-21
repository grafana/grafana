import React from 'react';

import { GraphSeriesValue } from '@grafana/data';

import { VizTooltipRow } from './VizTooltipRow';
import { ColorIndicator } from './types';

export interface SeriesListProps {
  series: SingleSeriesProps[];
}

// Based on SeriesTable, with new styling
export const SeriesList = ({ series }: SeriesListProps) => {
  return (
    <>
      {series.map((series, index) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const label = series.label as string;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const value = series.value as string;
        return (
          <VizTooltipRow
            key={`${series.label}-${index}`}
            label={label}
            value={value}
            color={series.color}
            colorIndicator={ColorIndicator.series}
            isActive={series.isActive}
            justify={'space-between'}
          />
        );
      })}
    </>
  );
};

export interface SingleSeriesProps {
  color?: string;
  label?: React.ReactNode;
  value?: string | GraphSeriesValue;
  isActive?: boolean;
  colorIndicator?: ColorIndicator;
}
