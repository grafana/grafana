import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Card } from '../Card/Card';

import { Stack } from './Stack';

const meta: Meta<typeof Stack> = {
  title: 'General/Stack',
  component: Stack,
  decorators: [withCenteredStory],
};

export const Basic: StoryFn<typeof Stack> = (props) => {
  return (
    <Stack {...props}>
      <Card> 1</Card>
      <Card> 2</Card>
      <Card> 3</Card>
    </Stack>
  );
};

export default meta;
