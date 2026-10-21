import { dashboardViewRoot, panelSelector, queryDashboardView } from './useChangeHighlights';

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
