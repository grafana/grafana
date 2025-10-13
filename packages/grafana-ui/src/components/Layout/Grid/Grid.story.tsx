import { Meta, StoryFn } from '@storybook/react';

import { useTheme2 } from '../../../themes';

import { Grid } from './Grid';
import mdx from './Grid.mdx';

const dimensions = Array.from({ length: 9 }).map(() => ({
  minHeight: `${Math.random() * 100 + 100}px`,
}));

const meta: Meta<typeof Grid> = {
  title: 'General/Layout/Grid',
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
  const theme = useTheme2();
  return (
    <Grid {...args}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ background: theme.colors.background.secondary, textAlign: 'center', ...dimensions[i] }}>
          N# {i}
        </div>
      ))}
    </Grid>
  );
};
ColumnsNumber.argTypes = {
  alignItems: {
    control: 'select',
    options: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end', 'self-start', 'self-end'],
  },
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
  const theme = useTheme2();
  return (
    <Grid gap={args.gap} minColumnWidth={args.minColumnWidth}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ background: theme.colors.background.secondary, textAlign: 'center' }}>
          N# {i}
        </div>
      ))}
    </Grid>
  );
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
