import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { ValueMappingsEditor } from './ValueMappingsEditor';

const ValueMappingsEditorStories = storiesOf('UI/ValueMappingsEditor', module);

ValueMappingsEditorStories.add('default', () => {
  return <ValueMappingsEditor valueMappings={[]} onChange={action('Mapping changed')} />;
});
