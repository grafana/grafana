import React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';
import { DeleteButton } from './DeleteButton';

const getKnobs = () => {
  return {
    size: select('Size', ['sm', 'md', 'lg'], 'md'),
    disabled: boolean('Disabled', false),
  };
};

storiesOf('General/ConfirmButton', module)
  .addDecorator(withCenteredStory)
  .add('delete button', () => {
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
  });
