import {
  type FieldConfigOptionsRegistry,
  type FieldConfigPropertyItem,
  type FieldConfigSource,
  Registry,
} from '@grafana/data';
import { fieldMatchersUI } from '@grafana/ui';

import { getFieldOverrideCategories } from './getFieldOverrideElements';

jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getDataLinksVariableSuggestions: () => [],
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      nestedFramesFieldOverrides: false,
    },
  },
}));

jest.mock('@grafana/ui', () => {
  const mockMatcherUi = {
    name: 'By Name',
    matcher: {
      validateOptions: (o: unknown): o is string => typeof o === 'string',
    },
    component: () => null,
  };
  return {
    ...jest.requireActual('@grafana/ui'),
    fieldMatchersUI: {
      getIfExists: jest.fn().mockReturnValue(mockMatcherUi),
      get: jest.fn().mockReturnValue(mockMatcherUi),
      selectOptions: jest.fn().mockReturnValue({ options: [] }),
    },
  };
});

const getIfExistsMock = fieldMatchersUI.getIfExists as jest.Mock;
const defaultMatcherUi = getIfExistsMock();

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

  it('drops overrides with unknown matcher id or invalid options shape, keeps valid siblings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    getIfExistsMock.mockReturnValueOnce(undefined);

    const registry = makeRegistry([makeItem('custom.a')]);
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [
        { matcher: { id: 'invalidMatcher', options: 'foo' }, properties: [] },
        {
          matcher: { id: 'byName', options: { name: 'value' } as unknown as string },
          properties: [],
        },
        { matcher: { id: 'byName', options: 'value' }, properties: [] },
      ],
    };

    const categories = getFieldOverrideCategories(fieldConfig, registry, [], '', jest.fn());

    expect(categories).toHaveLength(2);
    expect(categories[0].props.title).toBe('Override 3');
    expect(warnSpy).toHaveBeenCalledWith('Unknown field matcher id: "invalidMatcher", skipping override rule');
    expect(warnSpy).toHaveBeenCalledWith('Invalid options for field matcher "byName", skipping override rule', {
      name: 'value',
    });

    warnSpy.mockRestore();
    getIfExistsMock.mockReturnValue(defaultMatcherUi);
  });
});
