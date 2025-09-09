import { Meta, StoryFn } from '@storybook/react';

import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';
import { Card } from '../../Card/Card';

import { Grid } from './Grid';
import mdx from './Grid.mdx';

const dimensions = Array.from({ length: 9 }).map(() => ({
  minHeight: `${Math.random() * 100 + 100}px`,
}));

const meta: Meta<typeof Grid> = {
  title: 'Layout/Grid',
  component: Grid,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    gap: 1,
  },
};

export const ColumnsNumber: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid {...args}>
      {Array.from({ length: 9 }).map((_, i) => (
        <Card key={i} style={dimensions[i]}>
          <Card.Heading>N# {i}</Card.Heading>
        </Card>
      ))}
    </Grid>
  );
};
ColumnsNumber.argTypes = {
  alignItems: {
    control: 'select',
    options: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end', 'self-start', 'self-end'],
  },
  gap: SpacingTokenControl,
  rowGap: SpacingTokenControl,
  columnGap: SpacingTokenControl,
};
ColumnsNumber.args = {
  columns: 3,
};
ColumnsNumber.parameters = {
  controls: {
    exclude: ['minColumnWidth'],
  },
};

export const ColumnsMinWidth: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid {...args}>
      {Array.from({ length: 9 }).map((_, i) => (
        <Card key={i}>
          <Card.Heading>N# {i}</Card.Heading>
        </Card>
      ))}
    </Grid>
  );
};
ColumnsMinWidth.argTypes = {
  gap: SpacingTokenControl,
  rowGap: SpacingTokenControl,
  columnGap: SpacingTokenControl,
};
ColumnsMinWidth.args = {
  minColumnWidth: 21,
};
ColumnsMinWidth.parameters = {
  controls: {
    exclude: ['columns'],
  },
};

export default meta;
