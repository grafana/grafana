import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Stack } from '../../unstable';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Grid } from './Grid';
import mdx from './Grid.mdx';
import { GridItem } from './GridItem';

const gridItem = (index: number, color: string, width?: string, height?: string) => {
  const itemOrder = index + 1;
  return <div style={{ backgroundColor: color, width, height, fontSize: '12px' }}>Grid item nº{itemOrder}</div>;
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
  },
};

const colorList: string[] = ['red', 'DarkOrange', 'olive', 'green', 'blue', 'purple', 'brown', 'PaleVioletRed', 'teal'];

export const Basic: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid
      display={args.display}
      gap={args.gap}
      rowGap={args.rowGap}
      columnGap={args.columnGap}
      templateColumns={args.templateColumns}
      templateRows={args.templateRows}
      autoFlow={args.autoFlow}
      autoRows={args.autoRows}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <GridItem key={i}>{gridItem(i, colorList[i], undefined, undefined)}</GridItem>
      ))}
    </Grid>
  );
};

Basic.args = {
  templateColumns: 'repeat(3, 1fr)',
  gap: 2,
};

Basic.parameters = {
  controls: {
    exclude: ['display', 'alignItems', 'justifyItems', 'autoRows', 'columnStart', 'columnEnd', 'rowStart', 'rowEnd'],
  },
};

export const AlignItemsExamples: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid templateColumns="repeat(3,1fr)" templateRows="repeat(2, 1fr)" gap={4}>
      <span>
        <p>Align items stretch - Grid structure reference</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, undefined))}
        </Grid>
      </span>

      <span>
        <p>Align items start</p>
        <Grid
          {...args}
          display="grid"
          gap={2}
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="start"
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, '50%'))}
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
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, '50%'))}
        </Grid>
      </span>
      <span>
        <p>Align items stretch - Grid structure reference</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(2, 1fr)"
          templateRows="repeat(3, 50px)"
          alignItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, undefined))}
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
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, '50%'))}
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
    <Grid templateColumns="repeat(2,1fr)" templateRows="repeat(3, 1fr)" gap={4}>
      <span>
        <p>Justify items stretch - Grid structure reference</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, undefined))}
        </Grid>
      </span>
      <span>
        <p>Justify items stretch - Grid structure reference</p>
        <Grid
          {...args}
          display="grid"
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="stretch"
          gap={2}
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], undefined, undefined))}
        </Grid>
      </span>
      <span>
        <p>Justify items start</p>
        <Grid
          {...args}
          display="grid"
          gap={2}
          templateColumns="repeat(3, 100px)"
          templateRows="repeat(2, 50px)"
          justifyItems="start"
        >
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], '70%', undefined))}
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
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], '70%', undefined))}
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
          {Array.from({ length: 6 }).map((_, i) => gridItem(i, colorList[i], '70%', undefined))}
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

export const GridItemsPosition: StoryFn<typeof Grid> = (args) => {
  return (
    <Stack direction='column' gap={4}>
      <div>
        <p>Basic grid</p>
        <Grid {...args} display="grid" templateColumns="repeat(3, 1fr)" templateRows="repeat(2, 1fr)">
          {Array.from({ length: 6 }).map((_, i) => (
            <GridItem key={i}>{gridItem(i, colorList[i], undefined, undefined)}</GridItem>
          ))}
        </Grid>
      </div>
      <div>
        <p>First GridItem with `grid-row-start: 3` </p>
        <Grid {...args} display="grid" templateColumns="repeat(3, 1fr)" templateRows="repeat(2, 1fr)">
          {Array.from({ length: 6 }).map((_, i) => (
            <GridItem key={i} rowStart={i === 0 ? 3 : undefined}>
              {gridItem(i, colorList[i], undefined, undefined)}
            </GridItem>
          ))}
        </Grid>
      </div>
      <div>
        <p>Third GridItem with `grid-column-start: 1` </p>
        <Grid {...args} display="grid" templateColumns="repeat(3, 1fr)" templateRows="repeat(2, 1fr)">
          {Array.from({ length: 6 }).map((_, i) => (
            <GridItem key={i} columnStart={i === 2 ? 1 : undefined}>
              {gridItem(i, colorList[i], undefined, undefined)}
            </GridItem>
          ))}
        </Grid>
      </div>
      <div>
        <p>Second GridItem with `grid-row-end: span 2` </p>
        <Grid {...args} display="grid" templateColumns="repeat(3, 1fr)" templateRows="repeat(2, 1fr)">
          {Array.from({ length: 6 }).map((_, i) => (
            <GridItem key={i} rowEnd={i === 1 ? 'span 2' : undefined}>
              {gridItem(i, colorList[i], undefined, undefined)}
            </GridItem>
          ))}
        </Grid>
      </div>
      <div>
        <p>Forth GridItem with `grid-column-end: span 3` </p>
        <Grid {...args} display="grid" templateColumns="repeat(3, 1fr)" templateRows="repeat(2, 1fr)">
          {Array.from({ length: 6 }).map((_, i) => (
            <GridItem key={i} columnEnd={i === 3 ? 'span 3' : undefined}>
              {gridItem(i, colorList[i], undefined, undefined)}
            </GridItem>
          ))}
        </Grid>
      </div>
    </Stack>
  );
};
GridItemsPosition.parameters = {
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
export default meta;
