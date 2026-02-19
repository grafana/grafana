import { FieldConfigSource, PanelTypeChangedHandler } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { getV2AngularMigrationHandler, getAngularPanelMigrationHandler } from './angularMigration';

/**
 * Test type for mutable panel model used in migration handler tests.
 * Allows arbitrary properties to be added during migration.
 */
interface TestPanelModel {
  id: number;
  type: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
  targets?: Array<{ refId: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

describe('getAngularPanelMigrationHandler', () => {
  describe('Given an old angular panel', () => {
    it('Should call migration handler', () => {
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        panel.fieldConfig = { defaults: { unit: 'bytes' }, overrides: [] };
        return { name: prevOptions.angular.oldOptionProp };
      };

      const reactPlugin = getPanelPlugin({ id: 'timeseries' }).setPanelChangeHandler(onPanelTypeChanged);

      const oldModel = new PanelModel({
        autoMigrateFrom: 'graph',
        oldOptionProp: 'old name',
        type: 'timeseries',
      });

      const mutatedModel = {
        id: 1,
        type: 'timeseries',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getAngularPanelMigrationHandler(oldModel)(mutatedModel, reactPlugin);

      expect(mutatedModel.options).toEqual({ name: 'old name' });
      expect(mutatedModel.fieldConfig).toEqual({ defaults: { unit: 'bytes' }, overrides: [] });
    });
  });

  describe('Given a react panel with old angular properties', () => {
    it('Should pass panel model with old angular properties', () => {
      const reactPlugin = getPanelPlugin({ id: 'dashlist' });

      const oldModel = new PanelModel({
        angularProp: 'old name',
        type: 'dashlist',
      });

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'dashlist',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getAngularPanelMigrationHandler(oldModel)(mutatedModel, reactPlugin);

      expect(mutatedModel.angularProp).toEqual('old name');
    });
  });
});

describe('getV2AngularMigrationHandler', () => {
  describe('Given v2 migration data for an old angular panel (singlestat)', () => {
    it('Should call migration handler with angular wrapper for original options', () => {
      let receivedPrevPluginId: string | undefined;
      let receivedPrevOptions: Record<string, unknown> | undefined;

      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        receivedPrevPluginId = prevPluginId;
        receivedPrevOptions = prevOptions;
        panel.fieldConfig = { defaults: { unit: 'short' }, overrides: [] };
        return { reduceOptions: { calcs: ['mean'] }, orientation: 'horizontal' };
      };

      const reactPlugin = getPanelPlugin({ id: 'stat' }).setPanelChangeHandler(onPanelTypeChanged);

      // originalOptions only contains Angular-specific options, not known Panel properties
      const migrationData = {
        autoMigrateFrom: 'singlestat',
        originalOptions: {
          format: 'short',
          valueName: 'avg',
          orientation: 'horizontal',
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'stat',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify originalOptions were spread onto the panel (for plugins using setMigrationHandler)
      expect(mutatedModel['format']).toBe('short');
      expect(mutatedModel['valueName']).toBe('avg');
      expect(mutatedModel['orientation']).toBe('horizontal');

      // Verify handler received correct arguments
      expect(receivedPrevPluginId).toBe('singlestat');
      expect(receivedPrevOptions?.angular).toBeDefined();
      expect((receivedPrevOptions?.angular as Record<string, unknown>)?.format).toBe('short');
      expect((receivedPrevOptions?.angular as Record<string, unknown>)?.valueName).toBe('avg');

      // Verify mutation results
      expect(mutatedModel.options).toEqual({ reduceOptions: { calcs: ['mean'] }, orientation: 'horizontal' });
      expect(mutatedModel.fieldConfig).toEqual({ defaults: { unit: 'short' }, overrides: [] });
    });
  });

  describe('Given v2 migration data for graph panel', () => {
    it('Should call migration handler with angular wrapper', () => {
      let receivedPrevPluginId: string | undefined;
      let receivedPrevOptions: Record<string, unknown> | undefined;

      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        receivedPrevPluginId = prevPluginId;
        receivedPrevOptions = prevOptions;
        return { drawStyle: 'bars' };
      };

      const reactPlugin = getPanelPlugin({ id: 'timeseries' }).setPanelChangeHandler(onPanelTypeChanged);

      // originalOptions only contains Angular-specific options (bars, lines, etc.)
      const migrationData = {
        autoMigrateFrom: 'graph',
        originalOptions: {
          bars: true,
          lines: false,
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'timeseries',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify originalOptions were spread onto the panel (for plugins using setMigrationHandler)
      expect(mutatedModel['bars']).toBe(true);
      expect(mutatedModel['lines']).toBe(false);

      // Verify handler received correct arguments
      expect(receivedPrevPluginId).toBe('graph');
      expect(receivedPrevOptions?.angular).toBeDefined();
      expect((receivedPrevOptions?.angular as Record<string, unknown>)?.bars).toBe(true);

      // Verify mutation results
      expect(mutatedModel.options).toEqual({ drawStyle: 'bars' });
    });
  });

  describe('Given v2 migration data for non-angular panel migration', () => {
    it('Should pass options wrapper instead of angular wrapper', () => {
      let receivedPrevPluginId: string | undefined;
      let receivedPrevOptions: Record<string, unknown> | undefined;

      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        receivedPrevPluginId = prevPluginId;
        receivedPrevOptions = prevOptions;
        return { newOption: 'value' };
      };

      const reactPlugin = getPanelPlugin({ id: 'new-panel' }).setPanelChangeHandler(onPanelTypeChanged);

      // For non-angular panels, originalOptions contains the panel-specific options
      const migrationData = {
        autoMigrateFrom: 'some-react-panel', // Not in autoMigrateAngular list
        originalOptions: {
          oldOption: 'old',
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'new-panel',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify originalOptions were spread onto the panel (for plugins using setMigrationHandler)
      expect(mutatedModel['oldOption']).toBe('old');

      // Verify handler received correct arguments (options wrapper, not angular)
      expect(receivedPrevPluginId).toBe('some-react-panel');
      expect(receivedPrevOptions?.options).toBeDefined();
      expect(receivedPrevOptions?.angular).toBeUndefined();

      // Verify mutation results
      expect(mutatedModel.options).toEqual({ newOption: 'value' });
    });
  });

  describe('targets property access during migration', () => {
    it('Should proxy targets with deprecation warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      let accessedTargets: unknown;

      const onPanelTypeChanged: PanelTypeChangedHandler = (panel) => {
        // Access targets during migration (deprecated but supported)
        accessedTargets = panel.targets;
        return {};
      };

      const reactPlugin = getPanelPlugin({ id: 'stat' }).setPanelChangeHandler(onPanelTypeChanged);

      const migrationData = {
        autoMigrateFrom: 'singlestat',
        originalOptions: { format: 'short' },
      };

      const originalTargets = [{ refId: 'A', expr: 'test' }];
      const mutatedModel = {
        id: 1,
        type: 'stat',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
        targets: originalTargets,
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify targets were accessible and returned the cloned value
      expect(accessedTargets).toEqual(originalTargets);

      // Verify deprecation warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        'Accessing the targets property when migrating a panel plugin is deprecated. Changes to this property will be ignored.'
      );

      warnSpy.mockRestore();
    });
  });

  describe('Given v2 migration data for text panel with Angular-style properties', () => {
    it('Should spread originalOptions onto panel for migration handlers using setMigrationHandler', () => {
      // Text panel uses setMigrationHandler, not onPanelTypeChanged
      // The migration handler expects content/mode to be directly on the panel object
      const reactPlugin = getPanelPlugin({ id: 'text' });

      // This simulates a text panel with Angular-style properties at root level
      // The backend sets autoMigrateFrom="text" when it detects these properties
      const migrationData = {
        autoMigrateFrom: 'text',
        originalOptions: {
          content: 'Hello World',
          mode: 'markdown',
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'text',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify originalOptions were spread onto the panel
      // This allows textPanelMigrationHandler to see content/mode via panel.hasOwnProperty()
      expect(mutatedModel['content']).toBe('Hello World');
      expect(mutatedModel['mode']).toBe('markdown');
    });

    it('Should not overwrite existing panel properties when spreading originalOptions', () => {
      const reactPlugin = getPanelPlugin({ id: 'text' });

      const migrationData = {
        autoMigrateFrom: 'text',
        originalOptions: {
          content: 'Old content',
          mode: 'markdown',
          id: 999, // Should not overwrite existing id
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'text',
        options: { existingOption: true },
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // defaults() only sets properties that don't already exist
      expect(mutatedModel['content']).toBe('Old content');
      expect(mutatedModel['mode']).toBe('markdown');
      expect(mutatedModel.id).toBe(1); // Should keep original id
      expect(mutatedModel.options).toEqual({ existingOption: true }); // Should keep existing options
    });

    it('Should work with empty originalOptions', () => {
      const reactPlugin = getPanelPlugin({ id: 'text' });

      const migrationData = {
        autoMigrateFrom: 'text',
        originalOptions: {},
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'text',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      // Should not throw
      expect(() => {
        getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);
      }).not.toThrow();
    });

    it('Should spread originalOptions AND call onPanelTypeChanged if plugin has both', () => {
      let handlerCalled = false;
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        handlerCalled = true;
        // Verify originalOptions were already spread onto panel before handler is called
        expect((panel as TestPanelModel)['customProp']).toBe('custom value');
        return { migrated: true };
      };

      const reactPlugin = getPanelPlugin({ id: 'custom-panel' }).setPanelChangeHandler(onPanelTypeChanged);

      const migrationData = {
        autoMigrateFrom: 'custom-panel',
        originalOptions: {
          customProp: 'custom value',
        },
      };

      const mutatedModel: TestPanelModel = {
        id: 1,
        type: 'custom-panel',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      // Verify both behaviors occurred
      expect(mutatedModel['customProp']).toBe('custom value'); // originalOptions spread
      expect(handlerCalled).toBe(true); // onPanelTypeChanged called
      expect(mutatedModel.options).toEqual({ migrated: true }); // handler result applied
    });
  });
});
