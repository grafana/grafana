import {
  EventBusSrv,
  type FieldConfigOptionsRegistry,
  type FieldConfigPropertyItem,
  type FieldConfigSource,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelOptionsEditorBuilder,
  type PanelPlugin,
  Registry,
  type StandardEditorContext,
  toDataFrame,
} from '@grafana/data';
import { VizPanel } from '@grafana/scenes';

import {
  getStandardEditorContext,
  getVisualizationOptions2,
  isFieldConfigOptionVisible,
} from './getVisualizationOptions';

describe('getVisualizationOptions', () => {
  describe('getStandardEditorContext', () => {
    it('defaults the series data to an empty array', () => {
      const editorContext = getStandardEditorContext({
        data: undefined,
        replaceVariables: jest.fn(),
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
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
        fieldConfig: { defaults: {}, overrides: [] },
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
          documentation: 'Display name of the field (includes overrides and transformations)',
          label: 'Display name',
          origin: 'field',
          value: '__field.displayName',
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
        fieldConfig: { defaults: {}, overrides: [] },
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
          documentation: 'Display name of the field (includes overrides and transformations)',
          label: 'Display name',
          origin: 'field',
          value: '__field.displayName',
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
        currentOptions: {},
        currentFieldConfig: {
          defaults: {},
          overrides: [],
        },
        reportInteractionUI: 'panel-edit',
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
        currentOptions: {},
        currentFieldConfig: {
          defaults: {},
          overrides: [],
        },
        reportInteractionUI: 'panel-edit',
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
        currentOptions: {},
        currentFieldConfig: fieldConfig,
        reportInteractionUI: 'panel-edit',
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
        currentOptions: {},
        currentFieldConfig: fieldConfig,
        reportInteractionUI: 'panel-edit',
      });

      expect(vizOptions.length).toEqual(1);
      expect(vizOptions[0].items.length).toEqual(1);
      expect(showIfSpy.mock.calls.length).toEqual(1);
      expect(showIfSpy.mock.calls[0][0].displayName).toBe('default');
      expect(showIfSpy.mock.calls[0][2][0].fields[0].config.displayName).toBe('annotation');
    });
  });

  describe('isFieldConfigOptionVisible', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {
        unit: 'bytes',
        custom: { lineWidth: 2 },
      },
      overrides: [],
    };

    const makeItem = (overrides: Partial<FieldConfigPropertyItem> = {}): FieldConfigPropertyItem => ({
      id: 'unit',
      path: 'unit',
      name: 'Unit',
      process: (value) => value,
      shouldApply: () => true,
      override: jest.fn(),
      editor: jest.fn(),
      ...overrides,
    });

    const context = { data: [], options: { showValues: true }, fieldConfig } as StandardEditorContext<unknown, unknown>;

    it('shows a property that declares no showIf', () => {
      expect(isFieldConfigOptionVisible(makeItem(), fieldConfig, undefined, context)).toBe(true);
    });

    it('hides a property flagged hideFromDefaults without consulting showIf', () => {
      const showIf = jest.fn().mockReturnValue(true);

      expect(
        isFieldConfigOptionVisible(makeItem({ hideFromDefaults: true, showIf }), fieldConfig, undefined, context)
      ).toBe(false);
      expect(showIf).not.toHaveBeenCalled();
    });

    it('hides the property when showIf returns undefined', () => {
      const item = makeItem({ showIf: () => undefined });

      expect(isFieldConfigOptionVisible(item, fieldConfig, undefined, context)).toBe(false);
    });

    it('passes the standard defaults to a standard property and the custom defaults to a custom one', () => {
      const standardShowIf = jest.fn().mockReturnValue(true);
      const customShowIf = jest.fn().mockReturnValue(true);

      isFieldConfigOptionVisible(makeItem({ showIf: standardShowIf }), fieldConfig, undefined, context);
      isFieldConfigOptionVisible(makeItem({ isCustom: true, showIf: customShowIf }), fieldConfig, undefined, context);

      expect(standardShowIf.mock.calls[0][0]).toEqual({ unit: 'bytes', custom: { lineWidth: 2 } });
      expect(customShowIf.mock.calls[0][0]).toEqual({ lineWidth: 2 });
    });

    it('lets a standard property condition on a panel option via the editor context', () => {
      const item = makeItem({
        showIf: (_defaults, _data, _annotations, ctx) =>
          (ctx?.options as { showValues?: boolean } | undefined)?.showValues === true,
      });

      expect(isFieldConfigOptionVisible(item, fieldConfig, undefined, context)).toBe(true);
      expect(
        isFieldConfigOptionVisible(item, fieldConfig, undefined, { ...context, options: { showValues: false } })
      ).toBe(false);
    });

    it('lets a custom property condition on the standard defaults via the editor context', () => {
      const item = makeItem({
        isCustom: true,
        showIf: (_custom, _data, _annotations, ctx) => ctx?.fieldConfig?.defaults.unit === 'bytes',
      });

      expect(isFieldConfigOptionVisible(item, fieldConfig, undefined, context)).toBe(true);

      const withoutUnit: FieldConfigSource = { defaults: { custom: { lineWidth: 2 } }, overrides: [] };
      expect(isFieldConfigOptionVisible(item, withoutUnit, undefined, { ...context, fieldConfig: withoutUnit })).toBe(
        false
      );
    });

    it('passes the series and annotations through to showIf', () => {
      const showIf = jest.fn().mockReturnValue(true);
      const series = [toDataFrame({ fields: [{ name: 'value', values: [1] }] })];
      const annotations = [toDataFrame({ fields: [{ name: 'time', values: [1] }] })];

      isFieldConfigOptionVisible(
        makeItem({ showIf }),
        fieldConfig,
        { series, annotations, state: LoadingState.Done, timeRange: getDefaultTimeRange() },
        context
      );

      expect(showIf.mock.calls[0][1]).toBe(series);
      expect(showIf.mock.calls[0][2]).toBe(annotations);
    });
  });

  describe('editor context in showIf', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: { unit: 'bytes', custom: { lineWidth: 2 } },
      overrides: [],
    };

    const vizPanel = new VizPanel({ title: 'Panel A', pluginId: 'timeseries', key: 'panel-12', fieldConfig });

    const getPlugin = (
      fieldConfigItems: FieldConfigPropertyItem[],
      optionsSupplier?: (builder: PanelOptionsEditorBuilder<unknown>) => void
    ) =>
      ({
        meta: { skipDataQuery: false, name: 'Timeseries' },
        getPanelOptionsSupplier: () => optionsSupplier ?? (() => {}),
        fieldConfigRegistry: new Registry<FieldConfigPropertyItem>(() => fieldConfigItems),
      }) as unknown as PanelPlugin;

    const buildOptions = (plugin: PanelPlugin, currentOptions: Record<string, unknown>) =>
      getVisualizationOptions2({
        panel: vizPanel,
        eventBus: new EventBusSrv(),
        plugin,
        instanceState: {},
        currentOptions,
        currentFieldConfig: fieldConfig,
        reportInteractionUI: 'panel-edit',
      });

    it('hands a field config showIf the panel options and the whole field config', () => {
      const showIf = jest.fn().mockReturnValue(true);
      const plugin = getPlugin([
        {
          id: 'custom.property1',
          path: 'property1',
          isCustom: true,
          process: (value) => value,
          shouldApply: () => true,
          override: jest.fn(),
          editor: jest.fn(),
          name: 'Property 1',
          showIf,
        },
      ]);

      buildOptions(plugin, { showValues: true });

      const context = showIf.mock.calls[0][3];
      expect(context.options).toEqual({ showValues: true });
      expect(context.fieldConfig).toEqual(fieldConfig);
    });

    it('hides a standard field config property when a panel option turns it off', () => {
      const makePlugin = () =>
        getPlugin([
          {
            id: 'unit',
            path: 'unit',
            name: 'Unit',
            process: (value) => value,
            shouldApply: () => true,
            override: jest.fn(),
            editor: jest.fn(),
            showIf: (_defaults, _data, _annotations, ctx) =>
              (ctx?.options as { showUnit?: boolean } | undefined)?.showUnit === true,
          },
        ]);

      expect(buildOptions(makePlugin(), { showUnit: true })[0].items.length).toEqual(1);
      expect(buildOptions(makePlugin(), { showUnit: false })).toEqual([]);
    });

    it('hides a panel option when its showIf inspects the field config', () => {
      const supplier = (builder: PanelOptionsEditorBuilder<unknown>) => {
        builder.addCustomEditor({
          id: 'lineStyle',
          path: 'lineStyle',
          name: 'Line style',
          editor: jest.fn(),
          showIf: (_options, _data, _annotations, ctx) =>
            (ctx?.fieldConfig?.defaults.custom as { lineWidth?: number } | undefined)?.lineWidth === 99,
        });
      };

      expect(buildOptions(getPlugin([], supplier), {})).toEqual([]);
    });

    it('shows a panel option when its showIf matches the field config', () => {
      const supplier = (builder: PanelOptionsEditorBuilder<unknown>) => {
        builder.addCustomEditor({
          id: 'lineStyle',
          path: 'lineStyle',
          name: 'Line style',
          editor: jest.fn(),
          showIf: (_options, _data, _annotations, ctx) =>
            (ctx?.fieldConfig?.defaults.custom as { lineWidth?: number } | undefined)?.lineWidth === 2,
        });
      };

      const categories = buildOptions(getPlugin([], supplier), {});
      expect(categories.length).toEqual(1);
      expect(categories[0].items.length).toEqual(1);
    });
  });
});
