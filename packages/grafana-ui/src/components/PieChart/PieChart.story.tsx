import React from 'react';
import { Meta, Story } from '@storybook/react';
import { PieChart, PieChartProps, PieChartType, TooltipDisplayMode } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import {
  FieldColorModeId,
  FieldConfigSource,
  FieldType,
  InterpolateFunction,
  ReduceDataOptions,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { LegendDisplayMode, LegendPlacement } from '../VizLegend/models.gen';
import { PieChartLabels, PieChartLegendValues } from './types';

const fieldConfig: FieldConfigSource = {
  defaults: {
    thresholds: {
      mode: ThresholdsMode.Percentage,
      steps: [{ color: 'green', value: 0 }],
    },
    color: {
      mode: FieldColorModeId.PaletteClassic,
    },
  },
  overrides: [],
};
const reduceOptions: ReduceDataOptions = { calcs: [] };
const replaceVariables: InterpolateFunction = (v) => v;
const data = [
  {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [1620110299324, 1620110329324],
        state: {
          displayName: null,
          seriesIndex: 0,
        },
      },
      {
        name: 'Cellar',
        type: FieldType.number,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [27.008127592438484, 27.287423219155304],
        state: {
          displayName: 'Cellar',
          seriesIndex: 1,
        },
      },
    ],
  },
  {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [1620110299324, 1620110329324],
        state: {
          displayName: null,
          seriesIndex: 1,
        },
      },
      {
        name: 'Living room',
        type: FieldType.number,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [65.97347908625065, 65.6588311671438],
        state: {
          displayName: 'Living room',
          seriesIndex: 2,
        },
      },
    ],
  },
  {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [1620110299324, 1620110329324],
        state: {
          displayName: null,
          seriesIndex: 2,
        },
      },
      {
        name: 'Porch',
        type: FieldType.number,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [42.01219662436388, 42.48471312850685],
        state: {
          displayName: 'Porch',
          seriesIndex: 3,
        },
      },
    ],
  },
  {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [1620110299324, 1620110329324],
        state: {
          displayName: null,
          seriesIndex: 3,
        },
      },
      {
        name: 'Bedroom',
        type: FieldType.number,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [34.28143812581964, 34.37741979130198],
        state: {
          displayName: 'Bedroom',
          seriesIndex: 4,
        },
      },
    ],
  },
  {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        config: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
        },
        values: [1620110299324, 1620110329324],
        state: {
          displayName: null,
          seriesIndex: 4,
        },
      },
      {
        name: 'Guest room',
        type: FieldType.number,
        config: {
          color: {
            mode: 'palette-classic',
          },
        },
        values: [57.855438763786104, 57.521663794462654],
        state: {
          displayName: 'Guest room',
          seriesIndex: 5,
        },
      },
    ],
  },
];

export default {
  title: 'Visualizations/PieChart',
  decorators: [withCenteredStory],
  component: PieChart,
  args: {
    width: 500,
    height: 500,
    fieldConfig,
    data,
  },
  argTypes: {
    tooltipMode: {
      control: {
        type: 'select',
        options: Object.values(TooltipDisplayMode),
      },
    },
    legendDisplayMode: {
      control: {
        type: 'select',
        options: Object.values(LegendDisplayMode),
      },
    },
    legendPlacement: {
      control: {
        type: 'select',
        options: ['bottom', 'right'],
      },
    },
    legendValues: {
      control: {
        type: 'check',
        options: Object.values(PieChartLegendValues),
      },
    },
    displayLabels: {
      control: {
        type: 'check',
        options: Object.values(PieChartLabels),
      },
    },
    height: {
      control: { type: 'range', min: 300, max: 1000, step: 50 },
    },
    width: {
      control: { type: 'range', min: 300, max: 1000, step: 50 },
    },
  },
  parameters: {
    controls: {
      exclude: [
        'reduceOptions',
        'replaceVariables',
        'tooltipOptions',
        'onSeriesColorChange',
        'legendOptions',
        'timeZone',
      ],
    },
  },
} as Meta;

interface PieChartStoryProps extends PieChartProps {
  tooltipMode: TooltipDisplayMode;
  legendDisplayMode: LegendDisplayMode;
  legendPlacement: LegendPlacement;
  legendValues: PieChartLegendValues[];
}

const Template: Story<PieChartStoryProps> = ({
  tooltipMode,
  legendDisplayMode,
  legendPlacement,
  legendValues,
  data,
  ...args
}) => {
  const tooltipOpts = {
    mode: tooltipMode,
  };

  const legendOptions = {
    displayMode: legendDisplayMode,
    placement: legendPlacement,
    values: legendValues,
    calcs: [],
  };

  const dataPoints = data.map((d) => toDataFrame(d));

  return (
    <PieChart
      {...args}
      data={dataPoints}
      tooltipOptions={tooltipOpts}
      legendOptions={legendOptions}
      replaceVariables={replaceVariables}
      reduceOptions={reduceOptions}
    />
  );
};

export const basic = Template.bind({});

basic.args = {
  pieType: PieChartType.Pie,
  tooltipMode: TooltipDisplayMode.Single,
  legendDisplayMode: LegendDisplayMode.List,
  legendPlacement: 'bottom',
  legendValues: [PieChartLegendValues.Value],
  displayLabels: [PieChartLabels.Name],
};

export const donut = Template.bind({});

donut.args = {
  pieType: PieChartType.Donut,
  tooltipMode: TooltipDisplayMode.Single,
  legendDisplayMode: LegendDisplayMode.List,
  legendPlacement: 'bottom',
  legendValues: [PieChartLegendValues.Value],
  displayLabels: [PieChartLabels.Name],
};
