import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Grid } from './Grid';
import mdx from './Grid.mdx';

const meta: Meta<typeof Grid> = {
  title: 'General/Layout/Grid',
  component: Grid,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    display: 'grid',
    gap: 1,
  },
};

export const Basic: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid gap={args.gap}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i}> Item number {i}</div>
      ))}
    </Grid>
  );
};

Basic.args = {
  gap: 2,
};

Basic.parameters = {
  controls: {
    exclude: ['display'],
  },
};

export default meta;
