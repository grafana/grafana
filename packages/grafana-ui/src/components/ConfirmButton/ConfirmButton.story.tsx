import React from 'react';
import { storiesOf } from '@storybook/react';
import { text, boolean } from '@storybook/addon-knobs';
import { ConfirmButton } from './ConfirmButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';

const getKnobs = () => {
  return {
    buttonText: text('Button text', 'Edit'),
    confirmText: text('Confirm text', 'Save'),
    disabled: boolean('Disabled', false),
  };
};

storiesOf('UI/ConfirmButton', module)
  .addDecorator(withCenteredStory)
  .add('default', () => {
    const { buttonText, confirmText, disabled } = getKnobs();
    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <ConfirmButton
              buttonText={buttonText}
              confirmText={confirmText}
              disabled={disabled}
              onConfirm={() => {
                action('Saved')('save!');
              }}
            />
          </div>
        </div>
      </>
    );
  });
