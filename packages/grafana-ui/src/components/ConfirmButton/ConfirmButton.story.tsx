import React from 'react';
import { storiesOf } from '@storybook/react';
import { ConfirmButton } from './ConfirmButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';

storiesOf('UI/ConfirmButton', module)
  .addDecorator(withCenteredStory)
  .add('default', () => {
    return (
      <ConfirmButton
        onConfirm={() => {
          action('Delete Confirmed')('delete!');
        }}
      />
    );
  });
