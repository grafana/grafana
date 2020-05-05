import React, { useState } from 'react';
import { zip, fromPairs } from 'lodash';

import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { Input } from './Input';
import { text, select } from '@storybook/addon-knobs';
import { EventsWithValidation } from '../../../../utils';

const getKnobs = () => {
  return {
    validation: text('Validation regex (will do a partial match if you do not anchor it)', ''),
    validationErrorMessage: text('Validation error message', 'Input not valid'),
    validationEvent: select(
      'Validation event',
      fromPairs(zip(Object.keys(EventsWithValidation), Object.values(EventsWithValidation))),
      EventsWithValidation.onBlur
    ),
  };
};

const Wrapper = () => {
  const { validation, validationErrorMessage, validationEvent } = getKnobs();
  const [value, setValue] = useState('');
  const validations = {
    [validationEvent]: [
      {
        rule: (value: string) => {
          return !!value.match(validation);
        },
        errorMessage: validationErrorMessage,
      },
    ],
  };
  return <Input value={value} onChange={e => setValue(e.currentTarget.value)} validationEvents={validations} />;
};

export default {
  title: 'Forms/Legacy/Input',
  component: Input,
  decorators: [withCenteredStory],
};

export const basic = () => <Wrapper />;
