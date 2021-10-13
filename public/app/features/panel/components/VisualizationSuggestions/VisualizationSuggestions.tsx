import React from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { VisualizationPreview } from './VisualizationPreview';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  data: PanelData;
}

export function VisualizationSuggestions({ data }: Props) {
  const suggestions = getSuggestions();
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.heading}>Suggestions</div>
      <div className={styles.grid}>
        {suggestions.map((suggestion, index) => (
          <VisualizationPreview key={index} data={data} suggestion={suggestion} />
        ))}
      </div>
      <div className={styles.heading}>All</div>
    </div>
  );
}

function getSuggestions(): VisualizationSuggestion[] {
  return [
    {
      name: 'barchart horizontal',
      pluginId: 'barchart',
      options: {
        orientation: 'horizontal',
        showValue: 'never',
        legend: {
          displayMode: 'hidden',
        },
      },
      fieldConfig: {
        defaults: {
          custom: {
            axisPlacement: 'hidden',
          },
        },
        overrides: [],
      },
    },
    {
      name: 'Barchart vertical',
      pluginId: 'barchart',
      options: {
        orientation: 'vertical',
        showValue: 'never',
        legend: {
          displayMode: 'hidden',
        },
      },
      fieldConfig: {
        defaults: {
          custom: {
            axisPlacement: 'hidden',
          },
        },
        overrides: [],
      },
    },
    {
      name: 'Piechart',
      pluginId: 'piechart',
      options: {
        reduceOptions: {
          values: true,
        },
        legend: {
          displayMode: 'hidden',
        },
      },
    },
    {
      name: 'Piechart',
      pluginId: 'piechart',
      options: {
        reduceOptions: {
          values: true,
        },
        pieType: 'donut',
        legend: {
          displayMode: 'hidden',
        },
      },
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(1),
    }),
    grid: css({
      display: 'flex',
      flexWrap: 'wrap',
    }),
  };
};
