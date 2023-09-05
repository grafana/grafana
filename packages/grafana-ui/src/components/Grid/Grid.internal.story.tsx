import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Grid } from './Grid';
import mdx from './Grid.mdx';

const gridItem = (text: string, color: string) => {
  return <div style={{backgroundColor: color}}>Grid item nº{text}</div>;
};

const meta: Meta<typeof Grid> = {
  title: 'General/Layout/Grid',
  component: Grid,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof Grid> = ({
  display,
  gap,
  templateColumns,
  templateRows,
  autoFlow,
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
}) => {
 const colorList: string[] = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
  return (
    <Grid
      display={display}
      gap={gap}
      templateColumns={templateColumns}
      templateRows={templateRows}
      autoFlow={autoFlow}
      columnStart={columnStart}
      columnEnd={columnEnd}
      rowStart={rowStart}
      rowEnd={rowEnd}
    >
      {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i]))}
    </Grid>
  );
};

Basic.args = {
    templateColumns: 'repeat(3, 1fr)',
    gap: 2,
};

export default meta;
