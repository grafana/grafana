import { storiesOf } from '@storybook/react';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { RadioButton } from './RadioButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const RadioButtonStories = storiesOf('UI/RadioButton', module);
RadioButtonStories.addDecorator(withCenteredStory);

RadioButtonStories.add('RadioButtonGroup', () => {
  return renderComponentWithTheme(RadioButton, {});
});
