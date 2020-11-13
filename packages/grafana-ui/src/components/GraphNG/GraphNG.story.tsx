import { FieldColorModeId, toDataFrame } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphNG } from './GraphNG';
import { dateTime } from '@grafana/data';
import { LegendDisplayMode } from '../Legend/Legend';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { useTheme } from '../../themes';

export default {
  title: 'Visualizations/GraphNG',
  component: GraphNG,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Lines: React.FC = () => {
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
  seriesA.fields[1].config.unit = 'degree';

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
      legend={{ isVisible: true, displayMode: LegendDisplayMode.List, placement: 'bottom' }}
      timeZone="browser"
    ></GraphNG>
  );
};
