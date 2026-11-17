import { moveTabId } from './navigation';
import { parsePageCanvasModel } from './types';

const callbacks = () => ({
  onSelect: jest.fn(),
  onClose: jest.fn(),
  onReopen: jest.fn(),
  onReorder: jest.fn(),
  onCloseCanvas: jest.fn(),
});

const tab = (overrides: Record<string, unknown> = {}) => ({
  id: 'report',
  label: 'Report',
  closable: true,
  reorderable: true,
  shows: 'pane',
  ...overrides,
});

describe('parsePageCanvasModel', () => {
  it('rejects anything without a label and the required callbacks', () => {
    expect(parsePageCanvasModel(null)).toBeNull();
    expect(parsePageCanvasModel({ label: 'Canvas', tabs: [] })).toBeNull();
    const { onCloseCanvas, ...withoutClose } = callbacks();
    expect(parsePageCanvasModel({ label: 'Canvas', tabs: [], ...withoutClose })).toBeNull();
    expect(parsePageCanvasModel({ tabs: [], ...callbacks(), onCloseCanvas })).toBeNull();
  });

  it('keeps valid tabs and drops malformed or duplicate ones', () => {
    const model = parsePageCanvasModel({
      label: 'Canvas',
      activeTabId: 'report',
      tabs: [tab(), tab({ label: 'Duplicate' }), tab({ id: '' }), tab({ id: 'odd', shows: 'popup' }), 'not a tab'],
      closedTabs: [tab({ id: 'sources', label: 'Sources', count: 4 })],
      ...callbacks(),
    });
    expect(model?.tabs.map(({ id, label }) => ({ id, label }))).toEqual([{ id: 'report', label: 'Report' }]);
    expect(model?.closedTabs.map(({ id, count }) => ({ id, count }))).toEqual([{ id: 'sources', count: 4 }]);
  });

  it('keeps only paths in this Grafana, and drops a page tab without one', () => {
    const model = parsePageCanvasModel({
      label: 'Canvas',
      activeTabId: 'dash',
      tabs: [
        tab({ id: 'dash', shows: 'page', href: '/d/abc?orgId=1' }),
        tab({ id: 'elsewhere', shows: 'page', href: 'https://example.com/d/abc' }),
        tab({ id: 'protocol-relative', shows: 'page', href: '//example.com/d/abc' }),
        tab({ id: 'script', shows: 'pane', href: 'javascript:alert(1)' }),
      ],
      closedTabs: [],
      ...callbacks(),
    });
    expect(model?.tabs.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: 'dash', href: '/d/abc?orgId=1' },
      { id: 'script', href: undefined },
    ]);
  });

  it('falls back to the first tab when the active tab is not open', () => {
    const model = parsePageCanvasModel({
      label: 'Canvas',
      activeTabId: 'gone',
      tabs: [tab({ id: 'a' }), tab({ id: 'b' })],
      closedTabs: [],
      ...callbacks(),
    });
    expect(model?.activeTabId).toBe('a');
  });

  it('drops unknown icons and indicators, and defaults the flags to false', () => {
    const model = parsePageCanvasModel({
      label: 'Canvas',
      activeTabId: 'a',
      tabs: [
        { id: 'a', label: 'A', shows: 'pane', icon: 'not-an-icon', indicator: { kind: 'blinking', label: 'x' } },
        tab({ id: 'b', icon: 'apps', indicator: { kind: 'working', label: 'Updating' } }),
      ],
      closedTabs: [],
      ...callbacks(),
    });
    expect(model?.tabs[0]).toMatchObject({
      icon: undefined,
      indicator: undefined,
      closable: false,
      reorderable: false,
    });
    expect(model?.tabs[1]).toMatchObject({ icon: 'apps', indicator: { kind: 'working', label: 'Updating' } });
  });

  it('calls back into the plugin', () => {
    const plugin = callbacks();
    const model = parsePageCanvasModel({ label: 'Canvas', activeTabId: 'a', tabs: [tab({ id: 'a' })], ...plugin });
    model?.onClose(['a']);
    model?.onCloseCanvas();
    expect(plugin.onClose).toHaveBeenCalledWith(['a']);
    expect(plugin.onCloseCanvas).toHaveBeenCalled();
    expect(model?.onOpenAsPage).toBeUndefined();
  });
});

describe('moveTabId', () => {
  it('places a tab before or after another', () => {
    expect(moveTabId(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a']);
    expect(moveTabId(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b']);
    expect(moveTabId(['a', 'b', 'c'], 'b', 'b', true)).toEqual(['a', 'b', 'c']);
  });
});
