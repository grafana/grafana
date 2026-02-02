import {
  defaultPanelKind,
  defaultQueryGroupKind,
  defaultPanelQueryKind,
  defaultVizConfigKind,
  defaultGridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { isGridLayoutItemKind, isPanelKindV2 } from './validation';

describe('v2schema validation', () => {
  it('isPanelKindV2 returns true for a minimal valid PanelKind', () => {
    const panel = defaultPanelKind();
    // Ensure minimal required properties exist (defaults should be fine)
    panel.spec.vizConfig = defaultVizConfigKind();
    panel.spec.data = defaultQueryGroupKind();

    expect(isPanelKindV2(panel)).toBe(true);
  });

  it('returns false when kind is not "Panel"', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error intentional invalid kind for test
    panel.kind = 'NotAPanel';
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when data kind is wrong', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error intentional invalid kind for test
    panel.spec.data = { kind: 'Wrong', spec: {} };
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when queries contain invalid entries', () => {
    const panel = defaultPanelKind();
    panel.spec.data = defaultQueryGroupKind();
    // @ts-expect-error push an invalid query shape
    panel.spec.data.spec.queries = [{}];
    expect(isPanelKindV2(panel)).toBe(false);

    // Ensure a valid query shape passes
    panel.spec.data.spec.queries = [defaultPanelQueryKind()];
    expect(isPanelKindV2(panel)).toBe(true);
  });

  it('returns false when vizConfig.group is not a string', () => {
    const panel = defaultPanelKind();
    panel.spec.vizConfig = defaultVizConfigKind();
    // @ts-expect-error force wrong type
    panel.spec.vizConfig.group = 42;
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when transparent is not a boolean', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error wrong type
    panel.spec.transparent = 'yes';
    expect(isPanelKindV2(panel)).toBe(false);
  });
});

describe('isGridLayoutItemKind', () => {
  it('returns true for a valid GridLayoutItemKind', () => {
    const item = defaultGridLayoutItemKind();
    item.spec.x = 0;
    item.spec.y = 0;
    item.spec.width = 12;
    item.spec.height = 8;
    item.spec.element = { kind: 'ElementReference', name: 'panel-1' };

    expect(isGridLayoutItemKind(item)).toBe(true);
  });

  it.each([
    ['kind is not GridLayoutItem', { kind: 'NotAGridLayoutItem' }],
    ['x is not a number', { spec: { x: '0' } }],
    ['y is not a number', { spec: { y: null } }],
    ['width is not a number', { spec: { width: undefined } }],
    ['height is not a number', { spec: { height: {} } }],
    ['x is a float', { spec: { x: 1.5 } }],
    ['y is a float', { spec: { y: 2.7 } }],
    ['width is a float', { spec: { width: 12.1 } }],
    ['height is a float', { spec: { height: 8.9 } }],
    ['element is missing', { spec: { element: undefined } }],
    ['element.kind is not ElementReference', { spec: { element: { kind: 'WrongKind', name: 'panel-1' } } }],
    ['element.name is not a string', { spec: { element: { kind: 'ElementReference', name: 123 } } }],
  ])('returns false when %s', (_, override) => {
    const item = {
      ...defaultGridLayoutItemKind(),
      spec: {
        ...defaultGridLayoutItemKind().spec,
        element: { kind: 'ElementReference', name: 'panel-1' },
        ...((override as Record<string, unknown>).spec ?? {}),
      },
      ...Object.fromEntries(Object.entries(override).filter(([key]) => key !== 'spec')),
    };
    expect(isGridLayoutItemKind(item)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'string'],
    ['number', 123],
  ])('returns false for %s', (_, value) => {
    expect(isGridLayoutItemKind(value)).toBe(false);
  });
});
