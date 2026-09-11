import {
  type DynamicConfigValue,
  type FieldConfigOptionsRegistry,
  type FieldConfigPropertyItem,
  type FieldConfigSource,
  type DataFrame,
  FieldType,
  Registry,
} from '@grafana/data';

import { type OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { getFieldOverrideCategories } from './getFieldOverrideElements';

jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getDataLinksVariableSuggestions: () => [],
}));

jest.mock('@grafana/ui', () => {
  const byNameMatcherUi = {
    name: 'By Name',
    matcher: {},
    component: () => null,
  };

  return {
    ...jest.requireActual('@grafana/ui'),
    fieldMatchersUI: {
      get: jest.fn().mockReturnValue(byNameMatcherUi),
      getIfExists: jest.fn().mockImplementation((id?: string) => (id === 'byName' ? byNameMatcherUi : undefined)),
      selectOptions: jest.fn().mockReturnValue({ options: [] }),
    },
  };
});

function makeRegistry(items: FieldConfigPropertyItem[]): FieldConfigOptionsRegistry {
  return new Registry<FieldConfigPropertyItem>(() => items);
}

function makeItem(id: string, overrides?: Partial<FieldConfigPropertyItem>): FieldConfigPropertyItem {
  return {
    id,
    path: id,
    name: id,
    isCustom: true,
    process: (value) => value,
    shouldApply: () => true,
    override: jest.fn(),
    editor: jest.fn(),
    ...overrides,
  };
}

describe('getFieldOverrideCategories', () => {
  describe('scope-aware context for DataLink suggestions', () => {
    it('passes nested frames as context data for nested-scope overrides', () => {
      const nestedFrame: DataFrame = {
        fields: [{ name: 'event', type: FieldType.string, config: {}, values: [] }],
        length: 0,
      };
      const topLevelFrame: DataFrame = {
        fields: [
          { name: 'time', type: FieldType.time, config: {}, values: [] },
          { name: 'nested', type: FieldType.nestedFrames, config: {}, values: [[nestedFrame]] },
        ],
        length: 1,
      };

      const registry = makeRegistry([makeItem('links')]);
      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          { matcher: { id: 'byName', options: 'nested', scope: 'nested' }, properties: [{ id: 'links', value: [] }] },
          { matcher: { id: 'byName', options: 'time' }, properties: [{ id: 'links', value: [] }] },
        ],
      };

      const categories = getFieldOverrideCategories(fieldConfig, registry, [topLevelFrame], '', jest.fn());

      function getContextData(categoryIndex: number): DataFrame[] {
        const propertyItem = categories[categoryIndex].items.find((item) => item.props.id?.includes('-property-'));
        const element = propertyItem?.props.render(propertyItem) as React.ReactElement<{
          context: { data: DataFrame[] };
        }>;
        return element.props.context.data;
      }

      expect(getContextData(0)).toEqual([nestedFrame]);
      expect(getContextData(1)).toEqual([topLevelFrame]);
    });
  });

  describe('panel options in the editor context', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        { matcher: { id: 'byName', options: 'A-series' }, properties: [{ id: 'custom.lineWidth', value: 5 }] },
      ],
    };

    const getContextOptions = (options?: Record<string, unknown>) => {
      const registry = makeRegistry([makeItem('custom.lineWidth')]);
      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn(), options);

      const propertyItem = categories[0].items.find((item) => item.props.id?.includes('-property-'));
      const element = propertyItem?.props.render(propertyItem!) as React.ReactElement<{
        context: { options?: Record<string, unknown> };
      }>;

      return element.props.context.options;
    };

    it('hands the panel options to an override property editor', () => {
      const options = { variant: 'sankey' };

      expect(getContextOptions(options)).toBe(options);
    });

    it('leaves options undefined when a caller does not supply them', () => {
      // not defaulted to {}, so an editor's `context.options ?? fallback` still reaches the fallback
      expect(getContextOptions()).toBeUndefined();
    });
  });

  describe('hideFromOverrides', () => {
    it('excludes items with hideFromOverrides:true from the add override property picker', () => {
      const registry = makeRegistry([
        makeItem('custom.visible1'),
        makeItem('custom.hidden', { hideFromOverrides: true }),
        makeItem('custom.visible2'),
        makeItem('custom.hidden2', { excludeFromPicker: true }),
      ]);

      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [
          // matcher.options must be truthy for the add-property button to appear
          { matcher: { id: 'byName', options: 'someField' }, properties: [] },
        ],
      };

      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn());

      // categories[0] is the override rule; the last item is the "Add override property" ValuePicker
      const overrideCategory = categories[0];
      const addButtonItem = overrideCategory.items[overrideCategory.items.length - 1];
      const element = addButtonItem.props.render(addButtonItem) as React.ReactElement<{
        options: Array<{ value: string }>;
      }>;

      const optionValues = element.props.options.map((o) => o.value);
      expect(optionValues).toContain('custom.visible1');
      expect(optionValues).toContain('custom.visible2');
      expect(optionValues).not.toContain('custom.hidden');
      expect(optionValues).not.toContain('custom.hidden2');
    });

    it('includes all items when none have hideFromOverrides set', () => {
      const registry = makeRegistry([makeItem('custom.a'), makeItem('custom.b'), makeItem('custom.c')]);

      const fieldConfig: FieldConfigSource = {
        defaults: {},
        overrides: [{ matcher: { id: 'byName', options: 'someField' }, properties: [] }],
      };

      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn());

      const overrideCategory = categories[0];
      const addButtonItem = overrideCategory.items[overrideCategory.items.length - 1];
      const element = addButtonItem.props.render(addButtonItem) as React.ReactElement<{
        options: Array<{ value: string }>;
      }>;

      expect(element.props.options).toHaveLength(3);
    });
  });

  describe('showIfOverride', () => {
    const fieldConfigWith = (properties: FieldConfigSource['overrides'][number]['properties']): FieldConfigSource => ({
      defaults: {},
      // matcher.options must be truthy for the add-property button to appear
      overrides: [{ matcher: { id: 'byName', options: 'someField' }, properties }],
    });

    function getPickerOptionValues(categories: OptionsPaneCategoryDescriptor[]): string[] {
      const overrideCategory = categories[0];
      const addButtonItem = overrideCategory.items[overrideCategory.items.length - 1];
      const element = addButtonItem.props.render(addButtonItem) as React.ReactElement<{
        options: Array<{ value: string }>;
      }>;
      return element.props.options.map((o) => o.value);
    }

    it('excludes an item from the add override property picker when its predicate returns false', () => {
      const registry = makeRegistry([
        makeItem('custom.lineWidth', {
          showIfOverride: (context) => (context.options as { variant?: string })?.variant !== 'sankey',
        }),
        makeItem('custom.fillOpacity'),
      ]);

      const categories = getFieldOverrideCategories(fieldConfigWith([]), registry, [], '', jest.fn(), {
        variant: 'sankey',
      });

      expect(getPickerOptionValues(categories)).toEqual(['custom.fillOpacity']);
    });

    it('offers the item when the same predicate returns true for the current panel options', () => {
      const registry = makeRegistry([
        makeItem('custom.lineWidth', {
          showIfOverride: (context) => (context.options as { variant?: string })?.variant !== 'sankey',
        }),
        makeItem('custom.fillOpacity'),
      ]);

      const categories = getFieldOverrideCategories(fieldConfigWith([]), registry, [], '', jest.fn(), {
        variant: 'line',
      });

      expect(getPickerOptionValues(categories)).toEqual(['custom.lineWidth', 'custom.fillOpacity']);
    });

    it('offers items that declare no predicate', () => {
      const registry = makeRegistry([makeItem('custom.a'), makeItem('custom.b')]);

      const categories = getFieldOverrideCategories(fieldConfigWith([]), registry, [], '', jest.fn());

      expect(getPickerOptionValues(categories)).toEqual(['custom.a', 'custom.b']);
    });

    it('still renders the row for a rule that already set the hidden property, keeping its value', () => {
      const registry = makeRegistry([makeItem('custom.lineWidth', { showIfOverride: () => false })]);
      const fieldConfig = fieldConfigWith([{ id: 'custom.lineWidth', value: 5 }]);

      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn(), { variant: 'sankey' });

      // hiding it from the picker must not strand an existing override the user cannot see or remove
      expect(getPickerOptionValues(categories)).toEqual([]);

      const propertyItem = categories[0].items.find((item) => item.props.id?.includes('-property-'));
      expect(propertyItem).toBeDefined();

      const element = propertyItem!.props.render(propertyItem!) as React.ReactElement<{
        property: DynamicConfigValue;
      }>;
      expect(element.props.property).toEqual({ id: 'custom.lineWidth', value: 5 });
    });
  });

  describe('unknown matcher id', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [{ matcher: { id: 'byNamePattern', options: 'foo.*' }, properties: [{ id: 'links', value: [] }] }],
    };

    it('renders an error state for the override instead of throwing', () => {
      const registry = makeRegistry([makeItem('links')]);
      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn());

      // the broken override category + the "add button" category
      expect(categories).toHaveLength(2);

      const overrideCategory = categories[0];
      expect(overrideCategory.items).toHaveLength(1);
      expect(overrideCategory.items[0].props.id).toBe('panel-options-override-0-unknown-matcher');

      const element = overrideCategory.items[0].props.render(overrideCategory.items[0]) as React.ReactElement<{
        severity: string;
        title: string;
      }>;
      expect(element.props.severity).toBe('error');
      expect(element.props.title).toContain('byNamePattern');
    });

    it('keeps the remove override action working', () => {
      const registry = makeRegistry([makeItem('links')]);
      const onFieldConfigsChange = jest.fn();
      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', onFieldConfigsChange);

      const titleElement = categories[0].props.renderTitle?.(true) as React.ReactElement<{
        onOverrideRemove: () => void;
      }>;
      titleElement.props.onOverrideRemove();

      expect(onFieldConfigsChange).toHaveBeenCalledWith({ defaults: {}, overrides: [] });
    });
  });

  describe('matcher without visual editor', () => {
    // 'numeric' exists in the runtime fieldMatchers registry but has no options-pane UI
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [{ matcher: { id: 'numeric', options: {} }, properties: [{ id: 'links', value: [] }] }],
    };

    it('renders an info state saying the override is active, not an error', () => {
      const registry = makeRegistry([makeItem('links')]);
      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn());

      const overrideCategory = categories[0];
      expect(overrideCategory.items).toHaveLength(1);

      const element = overrideCategory.items[0].props.render(overrideCategory.items[0]) as React.ReactElement<{
        severity: string;
        title: string;
      }>;
      expect(element.props.severity).toBe('info');
      expect(element.props.title).toContain('no visual editor');
    });

    it('keeps the remove override action working', () => {
      const registry = makeRegistry([makeItem('links')]);
      const onFieldConfigsChange = jest.fn();
      const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', onFieldConfigsChange);

      const titleElement = categories[0].props.renderTitle?.(true) as React.ReactElement<{
        onOverrideRemove: () => void;
      }>;
      titleElement.props.onOverrideRemove();

      expect(onFieldConfigsChange).toHaveBeenCalledWith({ defaults: {}, overrides: [] });
    });
  });
});
