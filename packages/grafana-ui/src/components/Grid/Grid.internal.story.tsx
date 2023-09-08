import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Grid } from './Grid';
import mdx from './Grid.mdx';

const gridItem = (text: string, color: string, width?: string, height?: string) => {
  return <div style={{ backgroundColor: color, width, height }}>Grid item nº{text}</div>;
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
  args: {
    display: 'grid',
    gap: 1,
    columnGap: undefined,
    rowGap: undefined,
    templateColumns: undefined,
    templateRows: undefined,
    alignItems: undefined,
    justifyItems: undefined,
    autoFlow: undefined,
    autoRows: undefined,
    columnStart: undefined,
    columnEnd: undefined,
    rowStart: undefined,
    rowEnd: undefined,
  },
};

const colorList: string[] = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];

export const Basic: StoryFn<typeof Grid> = ({
  display,
  gap,
  columnGap,
  rowGap,
  templateColumns,
  templateRows,
  autoFlow,
  autoRows,
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
}) => {
  return (
    <Grid
      display={display}
      gap={gap}
      rowGap={rowGap}
      columnGap={columnGap}
      templateColumns={templateColumns}
      templateRows={templateRows}
      autoFlow={autoFlow}
      autoRows={autoRows}
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

Basic.parameters = {
  controls: {
    exclude: [
      'display',
      'alignItems',
      'justifyItems',
      'autoRows',
      'columnStart',
      'columnEnd',
      'rowStart',
      'rowEnd',
    ],
  },
};

export const AlignItemsExamples: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid templateColumns="repeat(4,1fr)" gap={4}>
      <span>
        <p>Align items start</p>
        <Grid
          {...args}
          display="grid"
          gap={4}
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="start"
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, '50%'))}
        </Grid>
      </span>
      <span>
        <p>Align items center</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="center"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, '50%'))}
        </Grid>
      </span>
      <span>
        <p>Align items end</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="end"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, '50%'))}
        </Grid>
      </span>
      <span>
        <p>Align items stretch</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, undefined))}
        </Grid>
      </span>
    </Grid>
  );
};

AlignItemsExamples.parameters = {
  controls: {
    exclude: [
      'display',
      'gap',
      'columnGap',
      'rowGap',
      'templateColumns',
      'templateRows',
      'alignItems',
      'justifyItems',
      'alignContent',
      'justifyContent',
      'autoFlow',
      'autoRows',
      'columnStart',
      'columnEnd',
      'rowStart',
      'rowEnd',
    ],
  },
};

export const JustifyItemsExamples: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid templateColumns="repeat(2,1fr)" gap={4}>
      <span>
        <p>Justify items start</p>
        <Grid
          {...args}
          display="grid"
          gap={4}
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="start"
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], '70%', undefined))}
        </Grid>
      </span>
      <span>
        <p>Justify items center</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="center"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], '70%', undefined))}
        </Grid>
      </span>
      <span>
        <p>Justify items end</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="end"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], '70%', undefined))}
        </Grid>
      </span>
      <span>
        <p>Justify items stretch</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, undefined))}
        </Grid>
      </span>
    </Grid>
  );
};

JustifyItemsExamples.parameters = {
  controls: {
    exclude: [
      'display',
      'gap',
      'columnGap',
      'rowGap',
      'templateColumns',
      'templateRows',
      'alignItems',
      'justifyItems',
      'autoFlow',
      'autoRows',
      'columnStart',
      'columnEnd',
      'rowStart',
      'rowEnd',
    ],
  },
};


export const gridItemsPosition: StoryFn<typeof Grid> = (args) => {
  return (
    <div style={{ width: '600px', border: '1px solid blue' }}>
      <Grid {...args} display='grid' templateColumns='repeat(3, 100px)' templateRows='repeat(2, 50px)' >
        {Array.from({ length: 6 }).map((_, i) => gridItem(i.toString(), colorList[i], undefined, undefined))}
      </Grid>
    </div>
  )
}

export default meta;
