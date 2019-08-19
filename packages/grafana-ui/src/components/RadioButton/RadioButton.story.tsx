import { storiesOf } from '@storybook/react';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { RadioButton } from './RadioButton';

const RadioButtonStories = storiesOf('UI/RadioButton', module);

RadioButtonStories.add('RadioButtonGroup', () => {
  return renderComponentWithTheme(RadioButton, {});
});
