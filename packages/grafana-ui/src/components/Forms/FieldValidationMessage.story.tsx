import React from 'react';
import { FieldValidationMessage } from './FieldValidationMessage';
import { text } from '@storybook/addon-knobs';

const getKnobs = () => {
  return {
    message: text('message', 'Invalid input message'),
  };
};

export default {
  title: 'Forms/FieldValidationMessage',
  component: FieldValidationMessage,
};

export const simple = () => {
  const { message } = getKnobs();

  return <FieldValidationMessage>{message}</FieldValidationMessage>;
};
