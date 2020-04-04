import React from 'react';
import { identityOverrideProcessor, standardEditorsRegistry } from '../field';
import { PanelPlugin, standardFieldConfigProperties } from './PanelPlugin';
import { FieldConfigProperty } from '../types';

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
  });

  describe('default options', () => {
    describe('panel options', () => {
      test('default values', () => {
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

      test('default values for nested paths', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.setPanelOptions(builder => {
          builder.addNumberInput({
            id: 'numericOption.nested',
            name: 'Option editor',
            description: 'Option editor description',
            defaultValue: 10,
          });
        });

        const expectedDefaults = {
          numericOption: { nested: 10 },
        };

        expect(panel.defaults).toEqual(expectedDefaults);
      });
    });

    describe('field config options', () => {
      test('default values', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.setCustomFieldOptions(builder => {
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
              override: () => <div>Override editor</div>,
              process: identityOverrideProcessor,
              shouldApply: () => true,
              settings: {},
              defaultValue: { value: 'Custom default value' },
            });
        });

        const expectedDefaults = {
          numericOption: 10,
          customOption: { value: 'Custom default value' },
        };

        expect(panel.fieldConfigDefaults.defaults.custom).toEqual(expectedDefaults);
      });

      test('default values for nested paths', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.setCustomFieldOptions(builder => {
          builder.addNumberInput({
            id: 'numericOption.nested',
            name: 'Option editor',
            description: 'Option editor description',
            defaultValue: 10,
          });
        });

        const expectedDefaults = {
          numericOption: { nested: 10 },
        };

        expect(panel.fieldConfigDefaults.defaults.custom).toEqual(expectedDefaults);
      });
    });

    describe('standard field config options', () => {
      test('standard config', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.useStandardFieldConfig();
        expect(panel.standardFieldConfigProperties).toEqual(Array.from(standardFieldConfigProperties.keys()));
      });

      test('selected standard config', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.useStandardFieldConfig([FieldConfigProperty.Min, FieldConfigProperty.Thresholds]);
        expect(panel.standardFieldConfigProperties).toEqual(['min', 'thresholds']);
      });

      describe('default values', () => {
        test('setting default values', () => {
          const panel = new PanelPlugin(() => {
            return <div>Panel</div>;
          });

          panel.useStandardFieldConfig([FieldConfigProperty.Color, FieldConfigProperty.Min], {
            [FieldConfigProperty.Color]: '#ff00ff',
            [FieldConfigProperty.Min]: 10,
          });

          expect(panel.standardFieldConfigProperties).toEqual(['color', 'min']);

          expect(panel.fieldConfigDefaults).toEqual({
            defaults: {
              min: 10,
              color: '#ff00ff',
            },
            overrides: [],
          });
        });

        it('should ignore defaults that are not specified as availeble properties', () => {
          const panel = new PanelPlugin(() => {
            return <div>Panel</div>;
          });

          panel.useStandardFieldConfig([FieldConfigProperty.Color], {
            [FieldConfigProperty.Color]: '#ff00ff',
            [FieldConfigProperty.Min]: 10,
          });

          expect(panel.standardFieldConfigProperties).toEqual(['color']);

          expect(panel.fieldConfigDefaults).toEqual({
            defaults: {
              color: '#ff00ff',
            },
            overrides: [],
          });
        });
      });
    });
  });
});
