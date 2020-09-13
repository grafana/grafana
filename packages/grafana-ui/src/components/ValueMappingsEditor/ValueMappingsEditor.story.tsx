import React from 'react';
import { action } from '@storybook/addon-actions';
import { ValueMappingsEditor } from './ValueMappingsEditor';

export default {
  title: 'Pickers and Editors/ValueMappingsEditor',
  component: ValueMappingsEditor,
};

export const basic = () => {
  return <ValueMappingsEditor valueMappings={[]} onChange={action('Mapping changed')} />;
};
