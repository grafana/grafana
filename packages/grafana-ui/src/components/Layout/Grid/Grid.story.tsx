import { Meta, StoryFn } from '@storybook/react';

import { useTheme2 } from '../../../themes/ThemeContext';
import { SpacingTokenControl } from '../../../utils/storybook/themeStorybookControls';

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
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
  const theme = useTheme2();
  return (
    <Grid {...args}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ background: theme.colors.background.secondary, textAlign: 'center' }}>
          N# {i}
        </div>
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
