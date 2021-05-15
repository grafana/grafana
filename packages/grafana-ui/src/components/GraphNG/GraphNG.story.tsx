import { FieldColorModeId, toDataFrame, dateTime } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphNG } from './GraphNG';
import { LegendDisplayMode } from '../VizLegend/types';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { useTheme } from '../../themes';
import { text, select } from '@storybook/addon-knobs';

export default {
  title: 'Visualizations/GraphNG',
  component: GraphNG,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

const getKnobs = () => {
  return {
    unit: text('Unit', 'short'),
    legendPlacement: select(
      'Legend placement',
      {
        bottom: 'bottom',
        right: 'right',
      },
      'bottom'
    ),
  };
};

export const Lines: React.FC = () => {
  const { unit, legendPlacement } = getKnobs();

  const theme = useTheme();
  const seriesA = toDataFrame({
    target: 'SeriesA',
    datapoints: [
      [10, 1546372800000],
      [20, 1546376400000],
      [10, 1546380000000],
    ],
  });

  seriesA.fields[1].config.custom = { line: { show: true } };
  seriesA.fields[1].config.color = { mode: FieldColorModeId.PaletteClassic };
  seriesA.fields[1].config.unit = unit;

  const data = prepDataForStorybook([seriesA], theme);

  return (
    <GraphNG
      data={data}
      width={600}
      height={400}
      timeRange={{
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
        raw: {
          from: dateTime(1546372800000),
          to: dateTime(1546380000000),
        },
      }}
      legend={{ displayMode: LegendDisplayMode.List, placement: legendPlacement, calcs: [] }}
      timeZone="browser"
    />
  );
};
