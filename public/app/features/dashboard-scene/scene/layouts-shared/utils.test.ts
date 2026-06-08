import { VizPanel } from '@grafana/scenes';

import { findAdjacentVizPanel, focusVizPanel, generateUniqueTitle } from './utils';

describe('generateUniqueTitle', () => {
  it('should return the original title if it is not in the existing titles', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['Other Title', 'Another Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });

  it('should handle undefined title by using empty string as base', () => {
    const existingTitles = new Set<string>(['Title 1', 'Title 2']);
    expect(generateUniqueTitle(undefined, existingTitles)).toBe('');
  });

  it('should append "1" to a title that does not end with a number', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 1');
  });

  it('should increment a number at the end of a title', () => {
    const title = 'My Title 1';
    const existingTitles = new Set<string>(['My Title 1', 'My Title 2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 3');
  });

  it('should handle multiple increments when needed', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title', 'My Title 1', 'My Title 2', 'My Title 3']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 4');
  });

  it('should handle titles with multiple numbers', () => {
    const title = 'My Title 123';
    const existingTitles = new Set<string>(['My Title 123', 'My Title 124']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 125');
  });

  it('should handle titles with spaces before the number', () => {
    const title = 'My Title  1';
    const existingTitles = new Set<string>(['My Title  1', 'My Title  2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title  3');
  });

  it('should handle empty existing titles set', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>();
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });
});

describe('findAdjacentVizPanel', () => {
  const a = new VizPanel({ key: 'panel-a', pluginId: 'table' });
  const b = new VizPanel({ key: 'panel-b', pluginId: 'table' });
  const c = new VizPanel({ key: 'panel-c', pluginId: 'table' });

  it('returns the next sibling when one exists', () => {
    const siblings = [{ panel: a }, { panel: b }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[1], siblings, (s) => s.panel)).toBe(c);
  });

  it('falls back to the previous sibling when removing the last item', () => {
    const siblings = [{ panel: a }, { panel: b }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[2], siblings, (s) => s.panel)).toBe(b);
  });

  it('skips siblings whose getPanel returns undefined', () => {
    const siblings = [{ panel: a }, { panel: undefined }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[0], siblings, (s) => s.panel)).toBe(c);
  });

  it('returns undefined when the removed item is not in siblings', () => {
    const siblings = [{ panel: a }];
    expect(findAdjacentVizPanel({ panel: b }, siblings, (s) => s.panel)).toBeUndefined();
  });

  it('returns undefined when there are no other panels', () => {
    const siblings = [{ panel: a }];
    expect(findAdjacentVizPanel(siblings[0], siblings, (s) => s.panel)).toBeUndefined();
  });
});

describe('focusVizPanel', () => {
  const originalRAF = window.requestAnimationFrame;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
  });

  it('focuses the section inside the matching data-viz-panel-key wrapper', () => {
    document.body.innerHTML = `
      <div data-viz-panel-key="panel-a"><section tabindex="0"></section></div>
      <div data-viz-panel-key="panel-b"><section tabindex="0"></section></div>
    `;

    const panel = new VizPanel({ key: 'panel-b', pluginId: 'table' });
    focusVizPanel(panel);

    const target = document.querySelector('[data-viz-panel-key="panel-b"] section');
    expect(document.activeElement).toBe(target);
  });

  it('does nothing when panel is undefined', () => {
    document.body.innerHTML = `<button id="other"></button>`;
    const other = document.getElementById('other')!;
    other.focus();

    focusVizPanel(undefined);

    expect(document.activeElement).toBe(other);
  });

  it('does nothing when no element matches the panel key', () => {
    document.body.innerHTML = `<button id="other"></button>`;
    const other = document.getElementById('other')!;
    other.focus();

    const panel = new VizPanel({ key: 'panel-missing', pluginId: 'table' });
    focusVizPanel(panel);

    expect(document.activeElement).toBe(other);
  });
});
