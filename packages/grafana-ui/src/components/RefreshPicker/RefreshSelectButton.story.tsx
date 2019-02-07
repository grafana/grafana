import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withKnobs, text } from '@storybook/addon-knobs';
import { RefreshSelectButton } from './RefreshSelectButton';

const RefreshSelectButtonStories = storiesOf('UI/RefreshPicker/RefresSelectButton', module);

RefreshSelectButtonStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

RefreshSelectButtonStories.add('default', () => {
  const value = text('Value', 'A value');
  return (
    <RefreshSelectButton
      onClick={() => {
        action('onClick fired')();
      }}
      value={value}
    />
  );
});
