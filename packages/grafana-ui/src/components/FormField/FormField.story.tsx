import React from 'react';
import { storiesOf } from '@storybook/react';
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

const FormFieldStories = storiesOf('General/FormField', module);

FormFieldStories.addDecorator(withCenteredStory);

FormFieldStories.add('default', () => {
  const { inputWidth, label, labelWidth } = getKnobs();
  return <FormField label={label} labelWidth={labelWidth} inputWidth={inputWidth} />;
});

FormFieldStories.add('with tooltip', () => {
  const { inputWidth, label, labelWidth, tooltip } = getKnobs();
  return <FormField label={label} labelWidth={labelWidth} inputWidth={inputWidth} tooltip={tooltip} />;
});
