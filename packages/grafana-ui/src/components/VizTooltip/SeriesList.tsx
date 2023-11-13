import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, GraphSeriesValue } from '@grafana/data';

import { useStyles2 } from '../../themes';

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
    <div className={styles.contentWrapper}>
      {color && <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator!} />}
      <span className={cx(styles.label, isActive && styles.activeSeries)}>{label}</span>
      <span className={cx(styles.value, isActive)}>{value}</span>
    </div>
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
    marginRight: 'auto',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    minWidth: '48px',
  }),
  value: css({
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
});
