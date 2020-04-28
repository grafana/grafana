import React from 'react';
import { text, boolean, select } from '@storybook/addon-knobs';
import { ConfirmButton } from './ConfirmButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';
import { Button } from '../Button';
import { DeleteButton } from './DeleteButton';

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
        destructive: 'destructive',
        link: 'link',
      },
      'primary'
    ),
    disabled: boolean('Disabled', false),
    closeOnConfirm: boolean('Close on confirm', true),
  };
};

export default {
  title: 'Buttons/ConfirmButton',
  component: ConfirmButton,
  decorators: [withCenteredStory],
  subcomponents: { DeleteButton },
};

export const basic = () => {
  const { size, buttonText, confirmText, confirmVariant, disabled, closeOnConfirm } = getKnobs();
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <ConfirmButton
            closeOnConfirm={closeOnConfirm}
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
};

export const withCustomButton = () => {
  const { buttonText, confirmText, confirmVariant, disabled, size, closeOnConfirm } = getKnobs();
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <ConfirmButton
            closeOnConfirm={closeOnConfirm}
            size={size}
            confirmText={confirmText}
            disabled={disabled}
            confirmVariant={confirmVariant}
            onConfirm={() => {
              action('Saved')('save!');
            }}
          >
            <Button size={size} variant="secondary" icon="pen">
              {buttonText}
            </Button>
          </ConfirmButton>
        </div>
      </div>
    </>
  );
};

export const deleteButton = () => {
  const { disabled, size } = getKnobs();
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <DeleteButton
            size={size}
            disabled={disabled}
            onConfirm={() => {
              action('Deleted')('delete!');
            }}
          />
        </div>
      </div>
    </>
  );
};
