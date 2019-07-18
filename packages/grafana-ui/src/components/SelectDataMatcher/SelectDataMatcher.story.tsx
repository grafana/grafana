import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SelectDataMatcher } from './SelectDataMatcher';
import { text } from '@storybook/addon-knobs';
import { DataMatcherConfig } from '@grafana/data';

const getKnobs = () => {
  return {
    placeholder: text('Placeholder Text', ''),
  };
};

const story = storiesOf('UI/DataMatcher', module);
story.addDecorator(withCenteredStory);
story.add('picker', () => {
  const { placeholder } = getKnobs();

  return (
    <div>
      <SelectDataMatcher
        placeholder={placeholder}
        onChange={(config: DataMatcherConfig) => {
          action('Picked:')(config);
        }}
      />
    </div>
  );
});
