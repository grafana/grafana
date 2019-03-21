import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { RefreshButton } from './RefreshButton';

const RefreshButtonStories = storiesOf('UI/RefreshPicker/RefreshButton', module);

RefreshButtonStories.addDecorator(withCenteredStory);

RefreshButtonStories.add('default', () => {
  return (
    <RefreshButton
      onClick={() => {
        action('onClick fired')();
      }}
    />
  );
});
