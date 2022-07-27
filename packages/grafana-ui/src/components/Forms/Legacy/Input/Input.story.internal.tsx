import { Meta, Story } from '@storybook/react';
import { zip, fromPairs } from 'lodash';
import React, { useState } from 'react';

import { EventsWithValidation } from '../../../../utils';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';

import { Input } from './Input';

const meta: Meta = {
  title: 'Forms/Legacy/Input',
  component: Input,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['inputRef', 'onBlur', 'onFocus', 'onChange'],
    },
  },
  argTypes: {
    validationEvents: {
      control: {
        type: 'select',
        options: fromPairs(zip(Object.keys(EventsWithValidation), Object.values(EventsWithValidation))),
      },
    },
    validation: { name: 'Validation regex (will do a partial match if you do not anchor it)' },
  },
};

const Wrapper: Story = (args) => {
  const [value, setValue] = useState('');
  const validations = {
    [args.validationEvents]: [
      {
        rule: (value: string) => {
          return !!value.match(args.validation);
        },
        errorMessage: args.validationErrorMessage,
      },
    ],
  };
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      validationEvents={validations}
      hideErrorMessage={args.hideErrorMessage}
    />
  );
};

export const Basic = Wrapper.bind({});
Basic.args = {
  validation: '',
  validationErrorMessage: 'Input not valid',
  validationEvents: EventsWithValidation.onBlur,
  hideErrorMessage: false,
};

export default meta;
