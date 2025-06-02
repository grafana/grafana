import { identityOverrideProcessor } from '../field/overrides/processors';
import {
  StandardEditorsRegistryItem,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty, FieldConfigPropertyItem } from '../types/fieldOverrides';
import { PanelMigrationModel } from '../types/panel';
import { PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';

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
        ] as FieldConfigPropertyItem[];
      });
      standardEditorsRegistry.setInit(() => {
        return [
          {
            id: 'number',
          },
        ] as StandardEditorsRegistryItem[];
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

            editor: () => <div>Editor</div>,

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

                editor: () => <div>Editor</div>,

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
            } as FieldConfigPropertyItem);
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

  describe('setMigrationHandler', () => {
    it('should handle synchronous migrations', () => {
      const panel = new PanelPlugin(() => <div>Panel</div>);
      const mockMigration = () => ({
        newOption: 'migrated',
      });

      panel.setMigrationHandler(mockMigration);

      const migrationModel: PanelMigrationModel = {
        id: 1,
        type: 'test-panel',
        options: { oldOption: 'value' },
        fieldConfig: { defaults: {}, overrides: [] },
        pluginVersion: '1.0.0',
      };

      expect(panel.onPanelMigration).toBeDefined();
      expect(panel.onPanelMigration!(migrationModel)).toEqual({
        newOption: 'migrated',
      });
    });

    it('should handle async migrations', async () => {
      const panel = new PanelPlugin(() => <div>Panel</div>);
      const mockAsyncMigration = async () => {
        return Promise.resolve({
          newOption: 'async-migrated',
        });
      };

      panel.setMigrationHandler(mockAsyncMigration);

      const migrationModel: PanelMigrationModel = {
        id: 1,
        type: 'test-panel',
        options: { oldOption: 'value' },
        fieldConfig: { defaults: {}, overrides: [] },
      };

      const result = await panel.onPanelMigration!(migrationModel);
      expect(result).toEqual({
        newOption: 'async-migrated',
      });
    });

    it('should handle complex panel migrations with advanced transformations', () => {
      const panel = new PanelPlugin(() => <div>Panel</div>);

      const mockMigration = (model: PanelMigrationModel) => {
        const { options, fieldConfig, title, id, type, pluginVersion } = model;

        //notice many of these migrations don't make sense in real code but are here
        //to make sure the attributes of the PanelMigrationModel are used and tested
        const baseMigration = {
          ...options,
          display: {
            ...options.display,
            mode: options.display?.type === 'legacy' ? 'modern' : options.display?.mode,
            title: title?.toLowerCase() ?? 'untitled',
            panelId: `${type}-${id}`,
          },
          thresholds: options.thresholds?.map((t: { value: string | number; color: string }) => ({
            ...t,
            value: typeof t.value === 'string' ? parseInt(t.value, 10) : t.value,
            // Use fieldConfig defaults for threshold colors if available
            color: fieldConfig.defaults?.color ?? t.color,
          })),
          metadata: {
            migrationVersion: pluginVersion ? `${pluginVersion} -> 2.0.0` : '2.0.0',
            migratedFields: Object.keys(fieldConfig.defaults ?? {}),
            overrideCount: fieldConfig.overrides?.length ?? 0,
          },
          // Merge custom field defaults into options
          customDefaults: fieldConfig.defaults?.custom ?? {},
          // Transform overrides into a map
          overrideMap: fieldConfig.overrides?.reduce(
            (acc, override) => ({
              ...acc,
              [override.matcher.id]: override.properties,
            }),
            {}
          ),
        };

        // Apply panel type specific migrations
        if (type.includes('visualization')) {
          return {
            ...baseMigration,
            visualizationSpecific: {
              enhanced: true,
              legacyFormat: false,
            },
          };
        }

        return baseMigration;
      };

      panel.setMigrationHandler(mockMigration);

      const complexModel: PanelMigrationModel = {
        id: 123,
        type: 'visualization-panel',
        title: 'Complex METRICS',
        pluginVersion: '1.0.0',
        options: {
          display: {
            type: 'legacy',
            showHeader: true,
          },
          thresholds: [
            { value: '90', color: 'red' },
            { value: '50', color: 'yellow' },
          ],
          queries: ['A', 'B'],
        },
        fieldConfig: {
          defaults: {
            color: { mode: 'thresholds' },
            custom: {
              lineWidth: 1,
              fillOpacity: 0.5,
            },
            mappings: [],
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'cpu' },
              properties: [{ id: 'color', value: 'red' }],
            },
            {
              matcher: { id: 'byValue', options: 'memory' },
              properties: [{ id: 'unit', value: 'bytes' }],
            },
          ],
        },
      };

      const result = panel.onPanelMigration!(complexModel);

      expect(result).toMatchObject({
        display: {
          mode: 'modern',
          showHeader: true,
          title: 'complex metrics',
          panelId: 'visualization-panel-123',
        },
        thresholds: [
          { value: 90, color: { mode: 'thresholds' } },
          { value: 50, color: { mode: 'thresholds' } },
        ],
        queries: ['A', 'B'],
        metadata: {
          migrationVersion: '1.0.0 -> 2.0.0',
          migratedFields: ['color', 'custom', 'mappings'],
          overrideCount: 2,
        },
        customDefaults: {
          lineWidth: 1,
          fillOpacity: 0.5,
        },
        overrideMap: {
          byName: [{ id: 'color', value: 'red' }],
          byValue: [{ id: 'unit', value: 'bytes' }],
        },
        visualizationSpecific: {
          enhanced: true,
          legacyFormat: false,
        },
      });
    });
  });
});
