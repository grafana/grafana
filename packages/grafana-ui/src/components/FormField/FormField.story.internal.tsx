import React from 'react';
import { number, text } from '@storybook/addon-knobs';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FormField } from './FormField';

const getKnobs = () => {
  return {
    label: text('label', 'Test'),
    tooltip: text('tooltip', 'This is a tooltip with information about this FormField'),
    labelWidth: number('labelWidth', 10),
    inputWidth: number('inputWidth', 20),
  };
};

export default {
  title: 'Forms/Legacy/FormField',
  component: FormField,
  decorators: [withCenteredStory],
};

export const basic = () => {
  const { inputWidth, label, labelWidth } = getKnobs();
  return <FormField label={label} labelWidth={labelWidth} inputWidth={inputWidth} />;
};

export const withTooltip = () => {
  const { inputWidth, label, labelWidth, tooltip } = getKnobs();
  return <FormField label={label} labelWidth={labelWidth} inputWidth={inputWidth} tooltip={tooltip} />;
};
