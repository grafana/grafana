import { VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { scrollCanvasElementIntoView, scrollIntoView } from './scrollCanvasElementIntoView';

describe('scrollCanvasElementIntoView', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.scrollIntoView = jest.fn();
    element.animate = jest.fn().mockReturnValue({ cancel: jest.fn() });
  });

  afterEach(() => {
    element.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('opens the containing tab and row before highlighting the mounted panel', () => {
    jest.useFakeTimers();
    const item = new AutoGridItem({ body: new VizPanel({}) });
    const row = new RowItem({
      collapse: true,
      layout: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [item] }) }),
    });
    const tab = new TabItem({ layout: new RowsLayoutManager({ rows: [row] }) });
    const tabs = new TabsLayoutManager({
      tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() }), tab],
    });

    scrollCanvasElementIntoView(item, item.containerRef, { highlight: true });

    expect(row.state.collapse).toBe(false);
    expect(tabs.getCurrentTab()).toBe(tab);
    expect(element.animate).not.toHaveBeenCalled();

    item.containerRef.current = element;
    document.body.appendChild(element);
    jest.advanceTimersByTime(10);

    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });
    expect(element.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ outline: '1px solid #3d71d9' })]),
      { duration: 2400 }
    );
  });

  it('highlights only the requested repeated panel, not its shared layout container', () => {
    const first = document.createElement('div');
    const repeated = document.createElement('div');
    first.dataset.vizPanelKey = 'panel-1';
    repeated.dataset.vizPanelKey = 'panel-1-clone-1';
    const chrome = document.createElement('section');
    chrome.animate = jest.fn().mockReturnValue({ cancel: jest.fn() });
    chrome.scrollIntoView = jest.fn();
    repeated.appendChild(chrome);
    element.append(first, repeated);

    scrollIntoView(element, { highlight: true, panelKey: 'panel-1-clone-1' });

    expect(chrome.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });
    expect(chrome.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ outline: '1px solid #3d71d9' })]),
      { duration: 2400 }
    );
    expect(element.animate).not.toHaveBeenCalled();
  });

  it('scrolls without highlighting when no highlight is requested', () => {
    scrollIntoView(element);

    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });
    expect(element.animate).not.toHaveBeenCalled();
  });

  it('gently pulses the outline and inset glow twice before fading out', () => {
    scrollIntoView(element, { highlight: true });

    const dim = {
      outline: '1px solid #3d71d933',
      outlineOffset: '-1px',
      boxShadow: 'inset 0 0 0px transparent',
      easing: 'ease-in-out',
    };
    const glow = {
      outline: '1px solid #3d71d9',
      outlineOffset: '-1px',
      boxShadow: 'inset 0 0 6px rgba(204, 204, 220, 0.15)',
      easing: 'ease-in-out',
    };
    expect(element.animate).toHaveBeenCalledWith([dim, glow, dim, glow, { ...dim, outline: '1px solid transparent' }], {
      duration: 2400,
    });
  });

  it('uses instant scrolling and a static outline with reduced motion', () => {
    jest.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia(''), matches: true });

    scrollIntoView(element, { highlight: true });

    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'center', inline: 'center' });
    expect(element.animate).toHaveBeenCalledWith(
      [
        { outline: '1px solid #3d71d9', outlineOffset: '-1px' },
        { outline: '1px solid #3d71d9', outlineOffset: '-1px' },
      ],
      { duration: 2000 }
    );
  });
});
