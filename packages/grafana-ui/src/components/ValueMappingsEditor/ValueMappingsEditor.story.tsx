import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { ValueMappingsEditor } from './ValueMappingsEditor';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const ValueMappingsEditorStories = storiesOf('UI/ValueMappingsEditor', module);

ValueMappingsEditorStories.addDecorator(withCenteredStory);

ValueMappingsEditorStories.add('default', () => {
  return (
    <ValueMappingsEditor
      valueMappings={[]}
      onChange={() => {
        action('Mapping changed');
      }}
    />
  );
});
