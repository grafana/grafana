import React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { SecretFormField } from './SecretFormField';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';

export default {
  title: 'Forms/SecretFormField',
  component: SecretFormField,
  decorators: [withCenteredStory],
};

const getSecretFormFieldKnobs = () => {
  return {
    isConfigured: boolean('Set configured state', false),
  };
};

export const basic = () => {
  const knobs = getSecretFormFieldKnobs();
  return (
    <UseState initialState="Input value">
      {(value, setValue) => (
        <SecretFormField
          label={'Secret field'}
          labelWidth={10}
          value={value}
          isConfigured={knobs.isConfigured}
          onChange={e => setValue(e.currentTarget.value)}
          onReset={() => {
            action('Value was reset')('');
            setValue('');
          }}
        />
      )}
    </UseState>
  );
};
