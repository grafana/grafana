import React from 'react';
import { storiesOf } from '@storybook/react';
import { DeleteButton } from './DeleteButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';

storiesOf('UI/DeleteButton', module)
  .addDecorator(withCenteredStory)
  .add('default', () => {
    return (
      <DeleteButton
        onConfirm={() => {
          action('Delete Confirmed')('delete!');
        }}
      />
    );
  });
