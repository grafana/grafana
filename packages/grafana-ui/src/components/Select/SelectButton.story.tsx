import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withKnobs, text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SelectButton } from './SelectButton';

const SelectButtonStories = storiesOf('UI/Select/SelectButton', module);

SelectButtonStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

SelectButtonStories.add('default', () => {
  const value = text('Selected Value:', 'Some value');
  const iconClass = text('Icon:', 'fa fa-clock-o fa-fw');

  return (
    <SelectButton
      value={value}
      iconClass={iconClass}
      textWhenUndefined={'NaN'}
      onClick={() => {
        action('onClick fired')();
      }}
    />
  );
});
