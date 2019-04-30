import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SeriesMatcherPicker } from './SeriesMatcherPicker';
import { text } from '@storybook/addon-knobs';
import { SeriesMatcherConfig } from '../../utils/index';

const getKnobs = () => {
  return {
    placeholder: text('Placeholder Text', ''),
  };
};

const story = storiesOf('UI/SeriesMatcher', module);
story.addDecorator(withCenteredStory);
story.add('picker', () => {
  const { placeholder } = getKnobs();

  return (
    <div>
      <SeriesMatcherPicker
        placeholder={placeholder}
        onChange={(config: SeriesMatcherConfig) => {
          action('Picked:')(config);
        }}
      />
    </div>
  );
});
