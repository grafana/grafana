import React from 'react';

import {
  EventBusSrv,
  FieldConfigOptionsRegistry,
  FieldConfigPropertyItem,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelPlugin,
  PanelOptionsEditorBuilder,
  Registry,
  toDataFrame,
} from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { getStandardEditorContext, getVisualizationOptions2 } from './getVisualizationOptions';

jest.mock('app/features/dashboard-scene/utils/interactions', () => ({
  DashboardInteractions: {
    quickEditOptionChanged: jest.fn(),
  },
}));

describe('getVisualizationOptions', () => {
  describe('getStandardEditorContext', () => {
    it('defaults the series data to an empty array', () => {
      const editorContext = getStandardEditorContext({
        data: undefined,
        replaceVariables: jest.fn(),
        options: {},
        eventBus: new EventBusSrv(),
        instanceState: {},
      });

      expect(editorContext.data).toEqual([]);
    });

    it('returns suggestions for empty data', () => {
      const editorContext = getStandardEditorContext({
        data: undefined,
        replaceVariables: jest.fn(),
        options: {},
        eventBus: new EventBusSrv(),
        instanceState: {},
      });

      expect(editorContext.getSuggestions).toBeDefined();
      expect(editorContext.getSuggestions?.()).toEqual([
        {
          documentation: 'Name of the series',
          label: 'Name',
          origin: 'series',
          value: '__series.name',
        },
        {
          documentation: 'Field name of the clicked datapoint (in ms epoch)',
          label: 'Name',
          origin: 'field',
          value: '__field.name',
        },
        {
          documentation: 'Adds current variables',
          label: 'All variables',
          origin: 'template',
          value: '__all_variables',
        },
        {
          documentation: 'Adds current time range',
          label: 'Time range',
          origin: 'built-in',
          value: '__url_time_range',
        },
        {
          documentation: "Adds current time range's from value",
          label: 'Time range: from',
          origin: 'built-in',
          value: '__from',
        },
        {
          documentation: "Adds current time range's to value",
          label: 'Time range: to',
          origin: 'built-in',
          value: '__to',
        },
      ]);
    });

    it('returns suggestions for non-empty data', () => {
      const series = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'score', type: FieldType.number },
          ],
        }),
      ];

      const panelData = {
        series,
        timeRange: getDefaultTimeRange(),
        state: LoadingState.Done,
      };

      const editorContext = getStandardEditorContext({
        data: panelData,
        replaceVariables: jest.fn(),
        options: {},
        eventBus: new EventBusSrv(),
        instanceState: {},
      });

      expect(editorContext.getSuggestions).toBeDefined();
      expect(editorContext.getSuggestions?.()).toEqual([
        {
          documentation: 'Name of the series',
          label: 'Name',
          origin: 'series',
          value: '__series.name',
        },
        {
          documentation: 'Field name of the clicked datapoint (in ms epoch)',
          label: 'Name',
          origin: 'field',
          value: '__field.name',
        },
        {
          documentation: 'Formatted value for time on the same row',
          label: 'time',
          origin: 'fields',
          value: '__data.fields.time',
        },
        {
          documentation: 'Formatted value for score on the same row',
          label: 'score',
          origin: 'fields',
          value: '__data.fields.score',
        },
        {
          documentation: 'Enter the field order',
          label: 'Select by index',
          origin: 'fields',
          value: '__data.fields[0]',
        },
        {
          documentation: 'the numeric field value',
          label: 'Show numeric value',
          origin: 'fields',
          value: '__data.fields.score.numeric',
        },
        {
          documentation: 'the text value',
          label: 'Show text value',
          origin: 'fields',
          value: '__data.fields.score.text',
        },
        {
          documentation: 'Adds current variables',
          label: 'All variables',
          origin: 'template',
          value: '__all_variables',
        },
        {
          documentation: 'Adds current time range',
          label: 'Time range',
          origin: 'built-in',
          value: '__url_time_range',
        },
        {
          documentation: "Adds current time range's from value",
          label: 'Time range: from',
          origin: 'built-in',
          value: '__from',
        },
        {
          documentation: "Adds current time range's to value",
          label: 'Time range: to',
          origin: 'built-in',
          value: '__to',
        },
      ]);
    });
  });

  describe('getVisualizationOptions2', () => {
    it('should create an options list with the right number of categories and items', () => {
      const vizPanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'timeseries',
        key: 'panel-12',
      });

      const property1: FieldConfigPropertyItem = {
        id: 'custom.property1', // Match field properties
        path: 'property1', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 1',
      };

      const property2: FieldConfigPropertyItem = {
        id: 'custom.property2', // Match field properties
        path: 'property2', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 2',
      };

      const property3: FieldConfigPropertyItem = {
        id: 'custom.property3.nested', // Match field properties
        path: 'property3.nested', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 3',
      };

      const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => {
        return [property1, property2, property3];
      });

      const plugin = {
        meta: { skipDataQuery: false },
        getPanelOptionsSupplier: jest.fn,
        getQuickEditPaths: () => [],
        fieldConfigRegistry: customFieldRegistry,
      } as unknown as PanelPlugin;

      const vizOptions = getVisualizationOptions2({
        panel: vizPanel,
        eventBus: new EventBusSrv(),
        plugin: plugin,
        instanceState: {},
      });

      expect(vizOptions.length).toEqual(1);
      expect(vizOptions[0].items.length).toEqual(3);
    });

    it('should not show items when the showIf evaluates to false', () => {
      const vizPanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'timeseries',
        key: 'panel-12',
      });

      const property1: FieldConfigPropertyItem = {
        id: 'custom.property1', // Match field properties
        path: 'property1', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 1',
        showIf: () => false,
      };

      const property2: FieldConfigPropertyItem = {
        id: 'custom.property2', // Match field properties
        path: 'property2', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 2',
      };

      const property3: FieldConfigPropertyItem = {
        id: 'custom.property3.nested', // Match field properties
        path: 'property3.nested', // Match field properties
        isCustom: true,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 3',
      };

      const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => {
        return [property1, property2, property3];
      });

      const plugin = {
        meta: { skipDataQuery: false },
        getPanelOptionsSupplier: jest.fn,
        getQuickEditPaths: () => [],
        fieldConfigRegistry: customFieldRegistry,
      } as unknown as PanelPlugin;

      const vizOptions = getVisualizationOptions2({
        panel: vizPanel,
        eventBus: new EventBusSrv(),
        plugin: plugin,
        instanceState: {},
      });

      expect(vizOptions.length).toEqual(1);
      expect(vizOptions[0].items.length).toEqual(2);
    });

    const fieldConfig = {
      defaults: {
        displayName: 'default',
        custom: {
          displayName: 'custom',
        },
      },
      overrides: [],
    };

    const vizPanel = new VizPanel({
      title: 'Panel A',
      pluginId: 'timeseries',
      key: 'panel-12',
      fieldConfig: fieldConfig,
    });

    const getOnePropVizPlugin = (isCustom: boolean, showIfSpy: jest.Mock) => {
      const property1: FieldConfigPropertyItem = {
        id: 'custom.property1', // Match field properties
        path: 'property1', // Match field properties
        isCustom: isCustom,
        process: (value) => value,
        shouldApply: () => true,
        override: jest.fn(),
        editor: jest.fn(),
        name: 'Property 1',
        showIf: showIfSpy,
      };

      const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => {
        return [property1];
      });

      return {
        meta: { skipDataQuery: false },
        getPanelOptionsSupplier: jest.fn,
        getQuickEditPaths: () => [],
        fieldConfigRegistry: customFieldRegistry,
      } as unknown as PanelPlugin;
    };

    it('showIf should get custom fieldConfig if isCustom is true', () => {
      const showIfSpy = jest.fn().mockReturnValue(true);

      const plugin = getOnePropVizPlugin(true, showIfSpy);

      const vizOptions = getVisualizationOptions2({
        panel: vizPanel,
        eventBus: new EventBusSrv(),
        plugin: plugin,
        instanceState: {},
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
          annotations: [
            {
              fields: [{ name: 'test', type: FieldType.string, config: { displayName: 'annotation' }, values: [1] }],
              length: 1,
            },
          ],
        },
      });

      expect(vizOptions.length).toEqual(1);
      expect(vizOptions[0].items.length).toEqual(1);
      expect(showIfSpy.mock.calls.length).toEqual(1);
      expect(showIfSpy.mock.calls[0][0].displayName).toBe('custom');
      expect(showIfSpy.mock.calls[0][2][0].fields[0].config.displayName).toBe('annotation');
    });

    it('showIf should get normal fieldConfig if isCustom is false', () => {
      const showIfSpy = jest.fn().mockReturnValue(true);

      const plugin = getOnePropVizPlugin(false, showIfSpy);

      const vizOptions = getVisualizationOptions2({
        panel: vizPanel,
        eventBus: new EventBusSrv(),
        plugin: plugin,
        instanceState: {},
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
          annotations: [
            {
              fields: [{ name: 'test', type: FieldType.string, config: { displayName: 'annotation' }, values: [1] }],
              length: 1,
            },
          ],
        },
      });

      expect(vizOptions.length).toEqual(1);
      expect(vizOptions[0].items.length).toEqual(1);
      expect(showIfSpy.mock.calls.length).toEqual(1);
      expect(showIfSpy.mock.calls[0][0].displayName).toBe('default');
      expect(showIfSpy.mock.calls[0][2][0].fields[0].config.displayName).toBe('annotation');
    });

    describe('quick edit telemetry', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      const createPluginWithQuickEdit = (quickEditPaths: string[]) => {
        const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => []);

        const plugin = {
          meta: { id: 'test-panel', skipDataQuery: false },
          getPanelOptionsSupplier: () => (builder: PanelOptionsEditorBuilder<{}>) => {
            builder.addSelect({
              path: 'testOption',
              name: 'Test Option',
              settings: { options: [] },
            });
            builder.addSelect({
              path: 'otherOption',
              name: 'Other Option',
              settings: { options: [] },
            });
          },
          getQuickEditPaths: () => quickEditPaths,
          fieldConfigRegistry: customFieldRegistry,
        } as unknown as PanelPlugin;

        return plugin;
      };

      it('should track option change when path is in quickEditPaths', () => {
        const panel = new VizPanel({
          title: 'Test Panel',
          pluginId: 'test-panel',
          key: 'panel-1',
          options: { testOption: 'initial' },
        });

        // Mock onOptionsChange to avoid full plugin setup
        panel.onOptionsChange = jest.fn();

        const plugin = createPluginWithQuickEdit(['testOption']);

        const vizOptions = getVisualizationOptions2({
          panel,
          eventBus: new EventBusSrv(),
          plugin,
          instanceState: {},
        });

        // Find the testOption item and trigger onChange
        const category = vizOptions.find((c) => c.items.some((i) => i.props.title === 'Test Option'));
        const item = category?.items.find((i) => i.props.title === 'Test Option');

        // Render the item to get the onChange handler
        const rendered = item?.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
        rendered?.props.onChange('newValue');

        expect(DashboardInteractions.quickEditOptionChanged).toHaveBeenCalledWith({
          panelType: 'test-panel',
          optionPath: 'testOption',
          source: 'panel_editor',
          dashboardUid: undefined,
        });
      });

      it('should not track option change when path is not in quickEditPaths', () => {
        const panel = new VizPanel({
          title: 'Test Panel',
          pluginId: 'test-panel',
          key: 'panel-1',
          options: { otherOption: 'initial' },
        });

        // Mock onOptionsChange to avoid full plugin setup
        panel.onOptionsChange = jest.fn();

        const plugin = createPluginWithQuickEdit(['testOption']); // otherOption is NOT in quickEditPaths

        const vizOptions = getVisualizationOptions2({
          panel,
          eventBus: new EventBusSrv(),
          plugin,
          instanceState: {},
        });

        // Find the otherOption item and trigger onChange
        const category = vizOptions.find((c) => c.items.some((i) => i.props.title === 'Other Option'));
        const item = category?.items.find((i) => i.props.title === 'Other Option');

        // Render the item to get the onChange handler
        const rendered = item?.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
        rendered?.props.onChange('newValue');

        expect(DashboardInteractions.quickEditOptionChanged).not.toHaveBeenCalled();
      });

      it('should not track when plugin has no quickEditPaths', () => {
        const panel = new VizPanel({
          title: 'Test Panel',
          pluginId: 'test-panel',
          key: 'panel-1',
          options: { testOption: 'initial' },
        });

        // Mock onOptionsChange to avoid full plugin setup
        panel.onOptionsChange = jest.fn();

        const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => []);

        const plugin = {
          meta: { id: 'test-panel', skipDataQuery: false },
          getPanelOptionsSupplier: () => (builder: PanelOptionsEditorBuilder<{}>) => {
            builder.addSelect({
              path: 'testOption',
              name: 'Test Option',
              settings: { options: [] },
            });
          },
          getQuickEditPaths: () => undefined,
          fieldConfigRegistry: customFieldRegistry,
        } as unknown as PanelPlugin;

        const vizOptions = getVisualizationOptions2({
          panel,
          eventBus: new EventBusSrv(),
          plugin,
          instanceState: {},
        });

        const category = vizOptions.find((c) => c.items.some((i) => i.props.title === 'Test Option'));
        const item = category?.items.find((i) => i.props.title === 'Test Option');

        const rendered = item?.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
        rendered?.props.onChange('newValue');

        expect(DashboardInteractions.quickEditOptionChanged).not.toHaveBeenCalled();
      });
    });
  });
});
