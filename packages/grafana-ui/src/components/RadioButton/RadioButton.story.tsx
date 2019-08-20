import React from 'react';
import { storiesOf } from '@storybook/react';
// import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { RadioButton } from './RadioButton';
import { RadioButtonGroup } from './RadioButtonGroup';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const RadioButtonStories = storiesOf('UI/RadioButton', module);
RadioButtonStories.addDecorator(withCenteredStory);

RadioButtonStories.add('RadioButtonGroup', () => {
  return (
    <RadioButtonGroup name="options" onChange={id => console.log('New value is: ' + id)}>
      <RadioButton id="label1">Label 1</RadioButton>
      <RadioButton id="label2">Label 2</RadioButton>
      <RadioButton id="label3">Label 3</RadioButton>
      <RadioButton id="label4">Label 4</RadioButton>
    </RadioButtonGroup>
  );
});
