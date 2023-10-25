import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, GraphSeriesValue } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { HorizontalGroup } from '../Layout/Layout';

import { VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { ColorIndicator } from './types';

export interface SeriesListProps {
  series: SingleSeriesProps[];
}

// Based on SeriesTable, with new styling
export const SeriesList = ({ series }: SeriesListProps) => {
  return (
    <>
      {series.map((series, index) => {
        return (
          <SingleSeries
            isActive={series.isActive}
            label={series.label}
            color={series.color}
            value={series.value}
            key={`${series.label}-${index}`}
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

const SingleSeries = ({ label, value, color, colorIndicator = ColorIndicator.series, isActive }: SingleSeriesProps) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify="space-between" spacing="md" className={styles.hgContainer}>
      <>
        {color && <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator} />}
        {label && <div className={cx(styles.label, isActive && styles.activeSeries)}>{label}</div>}
      </>
      {value && <div className={cx(isActive && styles.activeSeries)}>{value}</div>}
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  hgContainer: css({
    flexGrow: 1,
  }),
  activeSeries: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
  }),
});
