import { Meta, StoryFn } from '@storybook/react';

import { Stack } from '../Layout/Stack/Stack';

import { RadialGauge } from './RadialGauge';

const meta: Meta<typeof RadialGauge> = {
  title: 'Plugins/RadialGauge',
  component: RadialGauge,
  parameters: {
    controls: {},
  },
};

export const Examples: StoryFn<typeof RadialGauge> = (args) => {
  return (
    <Stack direction={'column'}>
      <RadialGauge value={250} min={0} max={360} />
      <RadialGauge value={50} min={0} max={360} />
    </Stack>
  );
};

export default meta;
