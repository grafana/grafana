import React from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Layout } from './Layout';
import { Button, VerticalGroup, HorizontalGroup } from '@grafana/ui';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { select } from '@storybook/addon-knobs';
import mdx from './Layout.mdx';

export default {
  title: 'Layout/Groups',
  component: Layout,
  decorators: [withStoryContainer, withCenteredStory, withHorizontallyCenteredStory],
  subcomponents: { HorizontalGroup, VerticalGroup },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const justifyVariants = ['flex-start', 'flex-end', 'space-between'];

const spacingVariants = ['xs', 'sm', 'md', 'lg'];

export const horizontal = () => {
  const justify = select('Justify elements', justifyVariants, 'flex-start');
  const spacing = select('Elements spacing', spacingVariants, 'sm');
  return (
    <HorizontalGroup justify={justify as any} spacing={spacing as any}>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </HorizontalGroup>
  );
};

export const vertical = () => {
  const justify = select('Justify elements', justifyVariants, 'flex-start');
  const spacing = select('Elements spacing', spacingVariants, 'sm');
  return (
    <VerticalGroup justify={justify as any} spacing={spacing as any}>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </VerticalGroup>
  );
};
