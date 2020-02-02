import React from 'react';

import { storiesOf } from '@storybook/react';
import FieldConfigEditor from './FieldConfigEditor';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FieldConfigSource, FieldConfigEditorRegistry, FieldPropertyEditorItem, Registry } from '@grafana/data';
import { NumberFieldConfigSettings, NumberValueEditor, NumberOverrideEditor, numberOverrideProcessor } from './number';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const FieldConfigStories = storiesOf('UI/FieldConfig', module);

FieldConfigStories.addDecorator(withCenteredStory);

const cfg: FieldConfigSource = {
  defaults: {
    title: 'Hello',
    decimals: 3,
  },
  overrides: [],
};

const columWidth: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
  id: 'width', // Match field properties
  name: 'Column Width',
  description: 'column width (for table)',

  editor: NumberValueEditor,
  override: NumberOverrideEditor,
  process: numberOverrideProcessor,

  settings: {
    placeholder: 'auto',
    min: 20,
    max: 300,
  },
};

export const customEditorRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  return [columWidth];
});

FieldConfigStories.add('default', () => {
  return renderComponentWithTheme(FieldConfigEditor, {
    config: cfg,
    data: [],
    custom: customEditorRegistry,
    onChange: (config: FieldConfigSource) => {
      console.log('Data', config);
    },
  });
});

// config?: FieldConfigSource;
// custom?: FieldConfigEditorRegistry; // custom fields
// include?: string[]; // Ordered list of which fields should be shown/included
// onChange: (config: FieldConfigSource) => void;
