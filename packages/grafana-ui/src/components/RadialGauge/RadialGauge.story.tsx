import { Meta, StoryFn } from '@storybook/react';

import { DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { Stack } from '../Layout/Stack/Stack';

import { RadialBar } from './RadialGauge';

const meta: Meta<typeof RadialBar> = {
  title: 'Plugins/RadialGauge',
  component: RadialBar,
  parameters: {
    controls: {},
  },
};

export const Examples: StoryFn<typeof RadialBar> = (args) => {
  return (
    <Stack direction={'column'}>
      <RadialBar value={250} min={0} max={360} />
      <RadialBar value={50} min={0} max={360} />
    </Stack>
  );
};

function getData(): DataFrame[] {
  const frame = toDataFrame({
    name: 'TestData',
    length: 3,
    fields: [
      {
        name: 'Column A',
        type: FieldType.string,
        values: [80],
        config: {},
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
      {
        name: 'Column B',
        type: FieldType.number,
        values: [1, 2, 3],
        config: {
          custom: {},
        },
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
    ],
  });

  //     // The applyFieldOverrides should add display processors, but we'll keep our explicit ones too
  //     return applyFieldOverrides({
  //       data: [frame],
  //       fieldConfig: {
  //         defaults: {},
  //         overrides: [],
  //       },
  //       replaceVariables: (value) => value,
  //       timeZone: 'utc',
  //       theme: createTheme(),
  //     })[0];
  // ]
}

export default meta;
