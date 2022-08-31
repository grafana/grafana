import React from 'react';

import { PanelOptionsEditorBuilder } from '..';
import { identityOverrideProcessor, standardEditorsRegistry, standardFieldConfigEditorRegistry } from '../field';
import { FieldConfigProperty } from '../types';

import { PanelPlugin } from './PanelPlugin';

describe('PanelPlugin', () => {
  describe('declarative options', () => {
    beforeAll(() => {
      standardFieldConfigEditorRegistry.setInit(() => {
        return [
          {
            id: FieldConfigProperty.Min,
            path: 'min',
          },
          {
            id: FieldConfigProperty.Max,
            path: 'max',
          },
        ] as any;
      });
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

      panel.useFieldConfig({
        useCustomConfig: (builder) => {
          builder.addCustomEditor({
            id: 'custom',
            path: 'custom',
            name: 'Custom',
            description: 'Custom field config property description',
            // eslint-disable-next-line react/display-name
            editor: () => <div>Editor</div>,
            // eslint-disable-next-line react/display-name
            override: () => <div>Editor</div>,
            process: identityOverrideProcessor,
            settings: {},
            shouldApply: () => true,
          });
        },
      });

      expect(panel.fieldConfigRegistry.list()).toHaveLength(3);
    });

    test('options UI API', () => {
      const panel = new PanelPlugin(() => {
        return <div>Panel</div>;
      });

      panel.setPanelOptions((builder) => {
        builder.addCustomEditor({
          id: 'option',
          path: 'option',
          name: 'Option editor',
          description: 'Option editor description',
          // eslint-disable-next-line react/display-name
          editor: () => <div>Editor</div>,
          settings: {},
        });
      });

      const supplier = panel.getPanelOptionsSupplier();
      expect(supplier).toBeDefined();

      const builder = new PanelOptionsEditorBuilder();
      supplier(builder, { data: [] });
      expect(builder.getItems()).toHaveLength(1);
    });
  });

  describe('default options', () => {
    describe('panel options', () => {
      test('default values', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.setPanelOptions((builder) => {
          builder
            .addNumberInput({
              path: 'numericOption',
              name: 'Option editor',
              description: 'Option editor description',
              defaultValue: 10,
            })
            .addNumberInput({
              path: 'numericOptionNoDefault',
              name: 'Option editor',
              description: 'Option editor description',
            })
            .addCustomEditor({
              id: 'customOption',
              path: 'customOption',
              name: 'Option editor',
              description: 'Option editor description',
              // eslint-disable-next-line react/display-name
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

        panel.setPanelOptions((builder) => {
          builder.addNumberInput({
            path: 'numericOption.nested',
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

        panel.useFieldConfig({
          useCustomConfig: (builder) => {
            builder
              .addNumberInput({
                path: 'numericOption',
                name: 'Option editor',
                description: 'Option editor description',
                defaultValue: 10,
              })
              .addNumberInput({
                path: 'numericOptionNoDefault',
                name: 'Option editor',
                description: 'Option editor description',
              })
              .addCustomEditor({
                id: 'customOption',
                path: 'customOption',
                name: 'Option editor',
                description: 'Option editor description',
                // eslint-disable-next-line react/display-name
                editor: () => <div>Editor</div>,
                // eslint-disable-next-line react/display-name
                override: () => <div>Override editor</div>,
                process: identityOverrideProcessor,
                shouldApply: () => true,
                settings: {},
                defaultValue: { value: 'Custom default value' },
              });
          },
        });

        const expectedDefaults = {
          numericOption: 10,
          customOption: { value: 'Custom default value' },
        };

        expect(panel.fieldConfigDefaults.defaults.custom).toEqual(expectedDefaults);
      });

      test('throw error with array fieldConfigs', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.useFieldConfig({
          useCustomConfig: (builder) => {
            builder.addCustomEditor({
              id: 'somethingUnique',
              path: 'numericOption[0]',
              name: 'Option editor',
              description: 'Option editor description',
              defaultValue: 10,
            } as any);
          },
        });
        expect(() => panel.fieldConfigRegistry).toThrowErrorMatchingInlineSnapshot(
          `"[undefined] Field config paths do not support arrays: custom.somethingUnique"`
        );
      });

      test('default values for nested paths', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.useFieldConfig({
          useCustomConfig: (builder) => {
            builder.addNumberInput({
              path: 'numericOption.nested',
              name: 'Option editor',
              description: 'Option editor description',
              defaultValue: 10,
            });
          },
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

        panel.useFieldConfig();
        expect(panel.fieldConfigRegistry.list()).toHaveLength(2);
      });

      test('disabling standard config properties', () => {
        const panel = new PanelPlugin(() => {
          return <div>Panel</div>;
        });

        panel.useFieldConfig({
          disableStandardOptions: [FieldConfigProperty.Min],
        });
        expect(panel.fieldConfigRegistry.list()).toHaveLength(1);
      });

      describe('default values', () => {
        test('setting default values', () => {
          const panel = new PanelPlugin(() => {
            return <div>Panel</div>;
          });

          panel.useFieldConfig({
            standardOptions: {
              [FieldConfigProperty.Max]: { defaultValue: 20 },
              [FieldConfigProperty.Min]: { defaultValue: 10 },
            },
          });

          expect(panel.fieldConfigRegistry.list()).toHaveLength(2);

          expect(panel.fieldConfigDefaults).toEqual({
            defaults: {
              min: 10,
              max: 20,
              custom: {},
            },
            overrides: [],
          });
        });

        it('should disable properties independently from the default values settings', () => {
          const panel = new PanelPlugin(() => {
            return <div>Panel</div>;
          });

          panel.useFieldConfig({
            standardOptions: {
              [FieldConfigProperty.Max]: { defaultValue: 20 },
            },
            disableStandardOptions: [FieldConfigProperty.Min],
          });

          expect(panel.fieldConfigRegistry.list()).toHaveLength(1);

          expect(panel.fieldConfigDefaults).toEqual({
            defaults: {
              max: 20,
              custom: {},
            },
            overrides: [],
          });
        });
      });
    });
  });
});
