import {
  type FieldConfigSource,
  FieldConfigProperty,
  type ItemKindContext,
  type ItemKindDescriptor,
  PanelPlugin,
  createTheme,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { getItemOverrideCategories } from './getItemOverrideElements';

jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getDataLinksVariableSuggestions: () => [],
}));

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const nodeKind: ItemKindDescriptor = {
  id: 'node',
  name: 'Nodes',
  getItems: () => [
    { id: 'gateway', label: 'Gateway' },
    { id: 'eu-west', label: 'EU West' },
  ],
  standardOptions: { [FieldConfigProperty.Color]: {} },
  useCustomConfig: (builder) => {
    builder.addNumberInput({ path: 'nodeRadius', name: 'Node radius' });
  },
};

const edgeKind: ItemKindDescriptor = {
  id: 'edge',
  name: 'Edges',
  getItems: () => [{ id: 'gateway--eu-west', label: 'gateway → eu-west' }],
  standardOptions: { [FieldConfigProperty.Color]: {} },
  useCustomConfig: (builder) => {
    builder.addNumberInput({ path: 'thickness', name: 'Thickness' });
  },
};

function makePlugin(kinds: ItemKindDescriptor[]): PanelPlugin {
  const plugin = new PanelPlugin(null);
  plugin.meta = { name: 'test' } as PanelPlugin['meta'];
  plugin.useItemConfig({ kinds });
  return plugin;
}

const singleKindPlugin = makePlugin([nodeKind]);
const twoKindPlugin = makePlugin([nodeKind, edgeKind]);

function configWith(itemOverrides: FieldConfigSource['itemOverrides']): FieldConfigSource {
  return { defaults: {}, overrides: [], itemOverrides };
}

const itemContext: ItemKindContext = {
  fieldConfig: { defaults: {}, overrides: [] },
  options: {},
  replaceVariables: (v: string) => v,
  theme: createTheme(),
};

describe('getItemOverrideCategories', () => {
  it('returns nothing when the plugin declares no item kinds', () => {
    const plugin = makePlugin([]);
    expect(getItemOverrideCategories(configWith([]), plugin, [], itemContext, '', jest.fn())).toEqual([]);
  });

  it('renders only the add button when there are no rules', () => {
    const categories = getItemOverrideCategories(
      configWith(undefined),
      singleKindPlugin,
      [],
      itemContext,
      '',
      jest.fn()
    );

    expect(categories).toHaveLength(1);
    expect(categories[0].props.id).toBe('add item override button');
  });

  it('adds a rule targeting the first declared kind', () => {
    const onFieldConfigsChange = jest.fn();
    const categories = getItemOverrideCategories(
      configWith(undefined),
      twoKindPlugin,
      [],
      itemContext,
      '',
      onFieldConfigsChange
    );

    const addButton = categories[categories.length - 1];
    const element = addButton.props.customRender!() as React.ReactElement<{
      onOverrideAdd: (v: { value: string }) => void;
    }>;
    element.props.onOverrideAdd({ value: 'byItemIds' });

    expect(onFieldConfigsChange).toHaveBeenCalledWith({
      defaults: {},
      overrides: [],
      itemOverrides: [{ matcher: { id: 'byItemIds', kind: 'node', options: [] }, properties: [] }],
    });
  });

  it('shows the kind selector only when the plugin declares more than one kind', () => {
    const fieldConfig = configWith([
      { matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] }, properties: [] },
    ]);

    const single = getItemOverrideCategories(fieldConfig, singleKindPlugin, [], itemContext, '', jest.fn());
    expect(single[0].items.map((i) => i.props.id)).not.toContain('panel-options-item-override-0-kind');

    const both = getItemOverrideCategories(fieldConfig, twoKindPlugin, [], itemContext, '', jest.fn());
    expect(both[0].items.map((i) => i.props.id)).toContain('panel-options-item-override-0-kind');
  });

  it('offers only the targeted kind property registry in the add-property picker', () => {
    const nodeRule = getItemOverrideCategories(
      configWith([{ matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] }, properties: [] }]),
      twoKindPlugin,
      [],
      itemContext,
      '',
      jest.fn()
    )[0];

    const addPropertyItem = nodeRule.items[nodeRule.items.length - 1];
    const element = addPropertyItem.props.render(addPropertyItem) as React.ReactElement<{
      options: Array<{ value: string }>;
    }>;

    const values = element.props.options.map((o) => o.value);
    expect(values).toContain('custom.nodeRadius');
    expect(values).not.toContain('custom.thickness');
  });

  it('drops properties the new kind cannot express when the kind is switched', () => {
    const onFieldConfigsChange = jest.fn();
    const categories = getItemOverrideCategories(
      configWith([
        {
          matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] },
          properties: [
            { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
            { id: 'custom.nodeRadius', value: 12 },
          ],
        },
      ]),
      twoKindPlugin,
      [],
      itemContext,
      '',
      onFieldConfigsChange
    );

    const kindItem = categories[0].items.find((i) => i.props.id === 'panel-options-item-override-0-kind')!;
    const element = kindItem.props.render(kindItem) as React.ReactElement<{ onChange: (kind: string) => void }>;
    element.props.onChange('edge');

    expect(onFieldConfigsChange).toHaveBeenCalledWith({
      defaults: {},
      overrides: [],
      itemOverrides: [
        {
          // color is offered by both kinds; custom.nodeRadius is not
          matcher: { id: 'byItemIds', kind: 'edge', options: undefined },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
        },
      ],
    });
  });

  it('renders an error state for a kind the plugin does not declare, instead of throwing', () => {
    const categories = getItemOverrideCategories(
      configWith([{ matcher: { id: 'byItemIds', kind: 'slice', options: ['a'] }, properties: [] }]),
      singleKindPlugin,
      [],
      itemContext,
      '',
      jest.fn()
    );

    // the broken rule + the add button
    expect(categories).toHaveLength(2);
    expect(categories[0].items).toHaveLength(1);
    expect(categories[0].items[0].props.id).toBe('panel-options-item-override-0-unresolvable');

    const element = categories[0].items[0].props.render(categories[0].items[0]) as React.ReactElement<{
      severity: string;
      title: string;
    }>;
    expect(element.props.severity).toBe('error');
    expect(element.props.title).toContain('slice');
  });

  it('renders an error state for an unknown matcher id', () => {
    const categories = getItemOverrideCategories(
      configWith([{ matcher: { id: 'noSuchMatcher', kind: 'node', options: [] }, properties: [] }]),
      singleKindPlugin,
      [],
      itemContext,
      '',
      jest.fn()
    );

    const element = categories[0].items[0].props.render(categories[0].items[0]) as React.ReactElement<{
      severity: string;
      title: string;
    }>;
    expect(element.props.severity).toBe('error');
    expect(element.props.title).toContain('noSuchMatcher');
  });

  it('keeps the remove action working for an unresolvable rule', () => {
    const onFieldConfigsChange = jest.fn();
    const categories = getItemOverrideCategories(
      configWith([{ matcher: { id: 'byItemIds', kind: 'slice', options: ['a'] }, properties: [] }]),
      singleKindPlugin,
      [],
      itemContext,
      '',
      onFieldConfigsChange
    );

    const titleElement = categories[0].props.renderTitle?.(true) as React.ReactElement<{
      onOverrideRemove: () => void;
    }>;
    titleElement.props.onOverrideRemove();

    expect(onFieldConfigsChange).toHaveBeenCalledWith({ defaults: {}, overrides: [], itemOverrides: [] });
  });

  it('leaves defaults and field overrides untouched when a rule changes', () => {
    const onFieldConfigsChange = jest.fn();
    const fieldConfig: FieldConfigSource = {
      defaults: { unit: 'bytes' },
      overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [] }],
      itemOverrides: [{ matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] }, properties: [] }],
    };

    const categories = getItemOverrideCategories(
      fieldConfig,
      singleKindPlugin,
      [],
      itemContext,
      '',
      onFieldConfigsChange
    );
    const titleElement = categories[0].props.renderTitle?.(true) as React.ReactElement<{
      onOverrideRemove: () => void;
    }>;
    titleElement.props.onOverrideRemove();

    expect(onFieldConfigsChange).toHaveBeenCalledWith({
      defaults: { unit: 'bytes' },
      overrides: fieldConfig.overrides,
      itemOverrides: [],
    });
  });
});
