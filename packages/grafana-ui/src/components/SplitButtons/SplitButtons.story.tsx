import React, { useState } from 'react';
import { SplitButtons } from './SplitButtons';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './SplitButtons.mdx';
import { Button, LinkButton } from '../Forms/Button';
import { ButtonSelect } from '../Forms/Select/ButtonSelect';
import { Icon } from '../Icon/Icon';
import { action } from '@storybook/addon-actions';

export default {
  title: 'General/SplitButtons',
  component: SplitButtons,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => (
  <SplitButtons>
    <Button>First</Button>
    <LinkButton variant="destructive">Second</LinkButton>
    <Button variant="secondary">Third</Button>
    <LinkButton>Fourth</LinkButton>
    <ButtonSelect onChange={() => {}} placeholder="Awesome" />
  </SplitButtons>
);

export const playControlsExample = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <SplitButtons>
      <Button
        onClick={() => {
          setIsPlaying(!isPlaying);
        }}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} />
      </Button>
      <Button onClick={() => setIsPlaying(false)} variant="destructive">
        <Icon name="stop" />
      </Button>
    </SplitButtons>
  );
};

export const splitButton = () => {
  return (
    <SplitButtons>
      <Button>Apply</Button>
      <Button>
        <Icon name="caret-down" />
      </Button>
    </SplitButtons>
  );
};
