import React from 'react';
import { storiesOf } from '@storybook/react';
import { text, boolean, select } from '@storybook/addon-knobs';
import { ConfirmButton } from './ConfirmButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';
import { Button } from '../Button/Button';

const getKnobs = () => {
  return {
    buttonText: text('Button text', 'Edit'),
    confirmText: text('Confirm text', 'Save'),
    size: select('Size', ['sm', 'md', 'lg'], 'md'),
    confirmVariant: select(
      'Confirm variant',
      {
        primary: 'primary',
        secondary: 'secondary',
        danger: 'danger',
        inverse: 'inverse',
        transparent: 'transparent',
      },
      'primary'
    ),
    disabled: boolean('Disabled', false),
  };
};

storiesOf('General/ConfirmButton', module)
  .addDecorator(withCenteredStory)
  .add('default', () => {
    const { size, buttonText, confirmText, confirmVariant, disabled } = getKnobs();
    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <ConfirmButton
              size={size}
              confirmText={confirmText}
              disabled={disabled}
              confirmVariant={confirmVariant}
              onConfirm={() => {
                action('Saved')('save!');
              }}
            >
              {buttonText}
            </ConfirmButton>
          </div>
        </div>
      </>
    );
  })
  .add('with custom button', () => {
    const { buttonText, confirmText, confirmVariant, disabled, size } = getKnobs();
    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <ConfirmButton
              size={size}
              confirmText={confirmText}
              disabled={disabled}
              confirmVariant={confirmVariant}
              onConfirm={() => {
                action('Saved')('save!');
              }}
            >
              <Button size={size} variant="secondary" icon="fa fa-pencil">
                {buttonText}
              </Button>
            </ConfirmButton>
          </div>
        </div>
      </>
    );
  });
