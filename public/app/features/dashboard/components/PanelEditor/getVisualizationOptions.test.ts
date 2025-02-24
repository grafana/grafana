import {
  EventBusSrv,
  FieldConfigOptionsRegistry,
  FieldConfigPropertyItem,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelPlugin,
  Registry,
  toDataFrame,
} from '@grafana/data';
import { VizPanel } from '@grafana/scenes';

import { getStandardEditorContext, getVisualizationOptions2 } from './getVisualizationOptions';

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
  });
});
