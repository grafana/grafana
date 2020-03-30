import React from 'react';
import { identityOverrideProcessor, standardEditorsRegistry } from '../field';
import { PanelPlugin } from './PanelPlugin';

describe('PanelPlugin', () => {
  describe('declarative options', () => {
    beforeAll(() => {
      standardEditorsRegistry.setInit(() => {
        return [
          {
            id: 'number',
          },
        ] as any;
      });
    });
    test('field config UI API', () => {
      const panel = new PanelPlugin(() => {
        return <div>Panel</div>;
      });

      panel.setCustomFieldOptions(builder => {
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

      panel.setPanelOptions(builder => {
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

    test('default option values', () => {
      const panel = new PanelPlugin(() => {
        return <div>Panel</div>;
      });

      panel.setPanelOptions(builder => {
        builder
          .addNumberInput({
            id: 'numericOption',
            name: 'Option editor',
            description: 'Option editor description',
            defaultValue: 10,
          })
          .addNumberInput({
            id: 'numericOptionNoDefault',
            name: 'Option editor',
            description: 'Option editor description',
          })
          .addCustomEditor({
            id: 'customOption',
            name: 'Option editor',
            description: 'Option editor description',
            editor: () => <div>Editor</div>,
            settings: {},
            defaultValue: { value: 'Custom default value' },
          });
      });

      const expectedDefaults = {
        numericOption: 10,
        customOption: { value: 'Custom default value' },
      };

      expect(panel.defaults).toEqual(expectedDefaults);
    });
  });
});
