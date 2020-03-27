import React from 'react';
import { identityOverrideProcessor } from '../field';
import { PanelPlugin } from './PanelPlugin';

describe('PanelPlugin', () => {
  describe('declarative options', () => {
    test('field config UI API', () => {
      const panel = new PanelPlugin(() => {
        return <div>Panel</div>;
      });

      panel.setCustomFieldConfigEditor(builder => {
        builder.addCustomEditor({
          id: 'custom',
          name: 'Custom',
          description: 'Custom field config property description',
          editor: () => <div>Editor</div>,
          override: () => <div>Editor</div>,
          process: identityOverrideProcessor,
          settings: {},
          shouldApply: () => true,
        });
      });

      expect(panel.customFieldConfigs).toBeDefined();
      expect(panel.customFieldConfigs!.list()).toHaveLength(1);
    });

    test('options UI API', () => {
      const panel = new PanelPlugin(() => {
        return <div>Panel</div>;
      });

      panel.setOptionsEditor(builder => {
        builder.addCustomEditor({
          id: 'option',
          name: 'Option editor',
          description: 'Option editor description',
          editor: () => <div>Editor</div>,
          settings: {},
        });
      });

      expect(panel.optionEditors).toBeDefined();
      expect(panel.optionEditors!.list()).toHaveLength(1);
    });
  });
});
