import { renderHook } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SpecChange } from './specDiff';
import { dashboardViewRoot, panelSelector, queryDashboardView, useChangeHighlights } from './useChangeHighlights';

// The same dashboard open on the page and in an embedded view inside it renders the same panel keys.
function render() {
  document.body.innerHTML = `
    <main id="page">
      <span id="page-anchor"></span>
      <div data-viz-panel-key="panel-1" id="page-panel"></div>
      <div data-dashboard-view="" id="embed">
        <span id="embed-anchor"></span>
        <div data-viz-panel-key="panel-1" id="embed-panel"></div>
      </div>
    </main>`;
}

describe('dashboard view scoping', () => {
  beforeEach(render);

  it('finds the page from its banner and the embedded view from its own', () => {
    expect(dashboardViewRoot(document.getElementById('page-anchor'))?.id).toBe('page');
    expect(dashboardViewRoot(document.getElementById('embed-anchor'))?.id).toBe('embed');
  });

  it("never reaches into another view's panels", () => {
    const page = dashboardViewRoot(document.getElementById('page-anchor'))!;
    const embed = dashboardViewRoot(document.getElementById('embed-anchor'))!;

    expect(queryDashboardView(page, panelSelector('panel-1')).map((el) => el.id)).toEqual(['page-panel']);
    expect(queryDashboardView(embed, panelSelector('panel-1')).map((el) => el.id)).toEqual(['embed-panel']);
  });
});

describe('change highlights', () => {
  const header = (title: string) =>
    `<div data-testid="${selectors.components.Panels.Panel.headerContainer}"><div><h2>${title}</h2></div></div>`;

  beforeEach(() => {
    document.body.innerHTML = `
      <main id="page">
        <span id="anchor"></span>
        <div data-viz-panel-key="panel-1" id="edited">${header('Rate')}</div>
        <div data-viz-panel-key="panel-2" id="untitled"></div>
        <div data-viz-panel-key="panel-3" id="unchanged">${header('CPU')}</div>
      </main>`;
  });

  const changes: SpecChange[] = [
    { type: 'edited', target: 'panel', name: 'Rate', parts: ['title'], panelKey: 'panel-1' },
    { type: 'added', target: 'panel', name: 'panel-2', panelKey: 'panel-2' },
  ];
  const getRoot = () => document.getElementById('page');
  const dashboard = {} as DashboardScene;

  it('puts a badge after a changed panel title, or in the corner of a panel without one', () => {
    const { result } = renderHook(() => useChangeHighlights(dashboard, changes, getRoot));

    const [edited, added] = result.current;
    expect(edited.change.panelKey).toBe('panel-1');
    expect(edited.mount.previousElementSibling?.querySelector('h2')?.textContent).toBe('Rate');
    expect(added.mount.parentElement?.id).toBe('untitled');
  });

  it('dims only the unchanged panels, and undoes everything once there is nothing to mark', () => {
    const { rerender, unmount } = renderHook(
      ({ marked }: { marked?: SpecChange[] }) => useChangeHighlights(dashboard, marked, getRoot),
      { initialProps: { marked: changes as SpecChange[] | undefined } }
    );
    expect(Array.from(document.querySelectorAll('[data-lifecycle-dimmed]')).map((el) => el.id)).toEqual(['unchanged']);

    rerender({ marked: undefined });
    expect(document.querySelector('[data-lifecycle-dimmed]')).toBeNull();
    expect(document.querySelector('[data-lifecycle-badge]')).toBeNull();

    rerender({ marked: changes });
    unmount();
    expect(document.querySelector('[data-lifecycle-badge], [data-lifecycle-dimmed]')).toBeNull();
  });
});
