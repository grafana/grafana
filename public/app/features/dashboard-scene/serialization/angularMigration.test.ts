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
    it('Should call migration handler with angular wrapper for original panel', () => {
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        // Migration handler receives { angular: originalPanel } for Angular panels
        expect(prevOptions.angular).toBeDefined();
        expect(prevOptions.angular.format).toBe('short');
        expect(prevOptions.angular.valueName).toBe('avg');
        panel.fieldConfig = { defaults: { unit: 'short' }, overrides: [] };
        return { reduceOptions: { calcs: ['mean'] }, orientation: 'horizontal' };
      };

      const reactPlugin = getPanelPlugin({ id: 'stat' }).setPanelChangeHandler(onPanelTypeChanged);

      const migrationData = {
        autoMigrateFrom: 'singlestat',
        originalPanel: {
          type: 'stat',
          autoMigrateFrom: 'singlestat',
          format: 'short',
          valueName: 'avg',
          orientation: 'horizontal',
          options: {},
          fieldConfig: {},
        },
      };

      const mutatedModel = {
        id: 1,
        type: 'stat',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      expect(mutatedModel.options).toEqual({ reduceOptions: { calcs: ['mean'] }, orientation: 'horizontal' });
      expect(mutatedModel.fieldConfig).toEqual({ defaults: { unit: 'short' }, overrides: [] });
    });
  });

  describe('Given v2 migration data for graph panel', () => {
    it('Should call migration handler with angular wrapper', () => {
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        expect(prevPluginId).toBe('graph');
        expect(prevOptions.angular).toBeDefined();
        expect(prevOptions.angular.bars).toBe(true);
        return { drawStyle: 'bars' };
      };

      const reactPlugin = getPanelPlugin({ id: 'timeseries' }).setPanelChangeHandler(onPanelTypeChanged);

      const migrationData = {
        autoMigrateFrom: 'graph',
        originalPanel: {
          type: 'timeseries',
          autoMigrateFrom: 'graph',
          bars: true,
          lines: false,
          options: {},
          fieldConfig: {},
        },
      };

      const mutatedModel = {
        id: 1,
        type: 'timeseries',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      expect(mutatedModel.options).toEqual({ drawStyle: 'bars' });
    });
  });

  describe('Given v2 migration data for non-angular panel migration', () => {
    it('Should pass options wrapper instead of angular wrapper', () => {
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        // Non-angular migrations receive { options: ... } instead of { angular: ... }
        expect(prevPluginId).toBe('some-react-panel');
        expect(prevOptions.options).toBeDefined();
        return { newOption: 'value' };
      };

      const reactPlugin = getPanelPlugin({ id: 'new-panel' }).setPanelChangeHandler(onPanelTypeChanged);

      const migrationData = {
        autoMigrateFrom: 'some-react-panel', // Not in autoMigrateAngular list
        originalPanel: {
          type: 'new-panel',
          autoMigrateFrom: 'some-react-panel',
          options: { oldOption: 'old' },
          fieldConfig: {},
        },
      };

      const mutatedModel = {
        id: 1,
        type: 'new-panel',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getV2AngularMigrationHandler(migrationData)(mutatedModel, reactPlugin);

      expect(mutatedModel.options).toEqual({ newOption: 'value' });
    });
  });
});
