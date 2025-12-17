import { PanelTypeChangedHandler } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { getV2AngularMigrationHandler, getAngularPanelMigrationHandler } from './angularMigration';

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

      const mutatedModel: any = {
        type: 'dashlist',
        options: {},
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

      const mutatedModel = {
        id: 1,
        type: 'stat',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

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

      const mutatedModel = {
        id: 1,
        type: 'timeseries',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

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

      const mutatedModel = {
        id: 1,
        type: 'new-panel',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

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
});
