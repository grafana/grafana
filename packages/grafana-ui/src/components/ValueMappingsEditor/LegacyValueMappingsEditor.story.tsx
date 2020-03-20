import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { LegacyValueMappingsEditor } from './LegacyValueMappingsEditor';

const ValueMappingsEditorStories = storiesOf('Panel/LegacyValueMappingsEditor', module);

ValueMappingsEditorStories.add('default', () => {
  return <LegacyValueMappingsEditor valueMappings={[]} onChange={action('Mapping changed')} />;
});
