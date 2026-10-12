import { FlagKeys } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardInteractions } from './interactions';
import { markViewPanelEnter, markViewPanelExit, trackViewPanelTransitions } from './viewPanelTracking';

function setup({ viewPanel }: { viewPanel?: string } = {}) {
  const panel = new VizPanel({ title: 'Panel A', pluginId: 'timeseries', key: 'panel-1' });
  const dashboard = new DashboardScene({ viewPanel, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  const entered = jest.spyOn(DashboardInteractions, 'viewPanelEntered').mockImplementation();
  const exited = jest.spyOn(DashboardInteractions, 'viewPanelExited').mockImplementation();
  const tracking = trackViewPanelTransitions(dashboard);

  return { dashboard, entered, exited, tracking };
}

describe('trackViewPanelTransitions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    setTestFlags({});
  });

  it('reports entering with the source marked by the control that opened view mode', () => {
    const { dashboard, entered } = setup();

    markViewPanelEnter('hover_popover');
    dashboard.setState({ viewPanel: 'panel-1' });

    expect(entered).toHaveBeenCalledWith({ source: 'hover_popover', panelType: 'timeseries', hoverActions: false });
  });

  it('reports entering as url when no control marked it', () => {
    const { dashboard, entered } = setup();

    dashboard.setState({ viewPanel: 'panel-1' });

    expect(entered).toHaveBeenCalledWith({ source: 'url', panelType: 'timeseries', hoverActions: false });
  });

  it('reports entering as url when the dashboard loads with a panel already maximized', () => {
    const { entered } = setup({ viewPanel: 'panel-1' });

    expect(entered).toHaveBeenCalledWith({ source: 'url', panelType: 'timeseries', hoverActions: false });
  });

  it('ignores a mark older than the transition window', () => {
    jest.useFakeTimers();
    const { dashboard, entered } = setup();

    markViewPanelEnter('menu');
    jest.advanceTimersByTime(1000);
    dashboard.setState({ viewPanel: 'panel-1' });

    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ source: 'url' }));
  });

  it('reports exiting with the marked method and how long the panel stayed maximized', () => {
    jest.useFakeTimers();
    const { dashboard, exited } = setup();

    dashboard.setState({ viewPanel: 'panel-1' });
    jest.advanceTimersByTime(4500);
    markViewPanelExit('pane_back');
    dashboard.setState({ viewPanel: undefined });

    expect(exited).toHaveBeenCalledWith({
      method: 'pane_back',
      durationMs: 4500,
      panelType: 'timeseries',
      hoverActions: false,
    });
  });

  it('reports exiting as escape when Escape is pressed while a panel is maximized', () => {
    const { dashboard, exited } = setup({ viewPanel: 'panel-1' });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    dashboard.setState({ viewPanel: undefined });

    expect(exited).toHaveBeenCalledWith(expect.objectContaining({ method: 'escape' }));
  });

  it.each([
    { desc: 'opens panel edit', opensPanelEdit: true, method: 'edit' },
    { desc: 'goes back to the dashboard', opensPanelEdit: false, method: 'url' },
  ])('reports an unmarked exit that $desc as $method', ({ opensPanelEdit, method }) => {
    const { dashboard, exited } = setup({ viewPanel: 'panel-1' });
    // The tracker only checks that panel edit is open, not what it holds
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const editPanel = opensPanelEdit ? ({} as DashboardScene['state']['editPanel']) : undefined;

    dashboard.setState({ viewPanel: undefined, editPanel });

    expect(exited).toHaveBeenCalledWith(expect.objectContaining({ method }));
  });

  it('reports whether the hover actions experiment is on', () => {
    setTestFlags({ [FlagKeys.GrafanaPanelHoverActions]: true });
    const { dashboard, entered } = setup();

    dashboard.setState({ viewPanel: 'panel-1' });

    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ hoverActions: true }));
  });

  it('stops reporting once unsubscribed', () => {
    const { dashboard, entered, tracking } = setup();

    tracking.unsubscribe();
    dashboard.setState({ viewPanel: 'panel-1' });

    expect(entered).not.toHaveBeenCalled();
  });
});
