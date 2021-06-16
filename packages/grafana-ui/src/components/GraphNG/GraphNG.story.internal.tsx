import { FieldColorModeId, toDataFrame, dateTime } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphNGProps } from './GraphNG';
import { LegendDisplayMode, LegendPlacement } from '../VizLegend/models.gen';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { useTheme2 } from '../../themes';
import { Story } from '@storybook/react';
import { TimeSeries } from '../TimeSeries/TimeSeries';

export default {
  title: 'Visualizations/GraphNG',
  component: TimeSeries,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['className', 'timeRange', 'data', 'legend', 'fields'],
    },
  },
  argTypes: {
    legendDisplayMode: { control: { type: 'radio', options: ['table', 'list', 'hidden'] } },
    placement: { control: { type: 'radio', options: ['bottom', 'right'] } },
    timeZone: { control: { type: 'radio', options: ['browser', 'utc'] } },
    width: { control: { type: 'range', min: 200, max: 800 } },
    height: { control: { type: 'range', min: 200, max: 800 } },
  },
};

interface StoryProps extends GraphNGProps {
  legendDisplayMode: string;
  placement: LegendPlacement;
  unit: string;
}
export const Lines: Story<StoryProps> = ({ placement, unit, legendDisplayMode, ...args }) => {
  const theme = useTheme2();
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
    <TimeSeries
      {...args}
      frames={data}
      legend={{
        displayMode:
          legendDisplayMode === 'hidden'
            ? LegendDisplayMode.Hidden
            : legendDisplayMode === 'table'
            ? LegendDisplayMode.Table
            : LegendDisplayMode.List,
        placement: placement,
        calcs: [],
      }}
      timeZone="browser"
    />
  );
};
Lines.args = {
  width: 600,
  height: 400,
  timeRange: {
    from: dateTime(1546372800000),
    to: dateTime(1546380000000),
    raw: {
      from: dateTime(1546372800000),
      to: dateTime(1546380000000),
    },
  },
  legendDisplayMode: 'list',
  placement: 'bottom',
  unit: 'short',
  timeZone: 'browser',
};
