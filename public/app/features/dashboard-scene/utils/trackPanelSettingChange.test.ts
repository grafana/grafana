import { getPanelPlugin } from '@grafana/data/test';
import { reportInteraction, setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardInteractions } from './interactions';
import { getPanelLinksChange, trackPanelSettingChange } from './trackPanelSettingChange';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function setup() {
  const panel = new VizPanel({ key: 'panel-3', title: 'CPU', pluginId: 'timeseries' });
  const dashboard = new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  return { panel, dashboard };
}

describe('trackPanelSettingChange', () => {
  let panelSettingChanged: jest.SpyInstance;

  beforeEach(() => {
    panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged');
    jest.mocked(reportInteraction).mockClear();
  });

  afterEach(() => {
    panelSettingChanged.mockRestore();
  });

  it('reports a change outside the panel editor as coming from the edit pane', () => {
    const { panel } = setup();

    trackPanelSettingChange(panel, 'change_panel_background');

    expect(panelSettingChanged).toHaveBeenCalledWith({
      item: 'change_panel_background',
      source: 'edit_pane',
      panel_type: 'timeseries',
      panel_id: 3,
    });
  });

  it('reports a change while the panel editor is open as coming from the panel editor', () => {
    const { panel, dashboard } = setup();
    dashboard.setState({ editPanel: buildPanelEditScene(panel) });

    trackPanelSettingChange(panel, 'change_panel_title');

    expect(panelSettingChanged).toHaveBeenCalledWith(expect.objectContaining({ source: 'panel_editor' }));
  });

  it('uses the given source over the inferred one', () => {
    const { panel } = setup();

    trackPanelSettingChange(panel, 'change_panel_title', 'outline');

    expect(panelSettingChanged).toHaveBeenCalledWith(expect.objectContaining({ source: 'outline' }));
  });

  it('does not report, or throw, for a panel without a key', () => {
    const panel = new VizPanel({ title: 'CPU', pluginId: 'timeseries' });
    panel.setState({ key: undefined });

    expect(() => trackPanelSettingChange(panel, 'change_panel_title', 'outline')).not.toThrow();
    expect(panelSettingChanged).not.toHaveBeenCalled();
  });

  it('sends the change as dashboards_edit_action_clicked without the setting value', () => {
    const { panel } = setup();

    trackPanelSettingChange(panel, 'change_panel_title');

    expect(reportInteraction).toHaveBeenCalledTimes(1);
    const [name, properties] = jest.mocked(reportInteraction).mock.calls[0];
    expect(name).toBe('dashboards_edit_action_clicked');
    expect(properties).toMatchObject({
      item: 'change_panel_title',
      source: 'edit_pane',
      panel_type: 'timeseries',
      panel_id: 3,
    });
    expect(JSON.stringify(properties)).not.toContain('CPU');
  });
});

describe('getPanelLinksChange', () => {
  const docs = { title: 'Docs', url: '/docs' };
  const runbook = { title: 'Runbook', url: '/runbook' };

  it.each([
    { name: 'a link is added', prev: [docs], next: [docs, runbook], expected: 'add_panel_link' },
    { name: 'a link is removed', prev: [docs, runbook], next: [docs], expected: 'remove_panel_link' },
    { name: 'a link is edited', prev: [docs], next: [{ ...docs, url: '/docs/v2' }], expected: 'edit_panel_link' },
    { name: 'links are reordered', prev: [docs, runbook], next: [runbook, docs], expected: 'reorder_panel_links' },
    { name: 'a link is saved without changes', prev: [docs], next: [{ ...docs }], expected: undefined },
  ])('returns $expected when $name', ({ prev, next, expected }) => {
    expect(getPanelLinksChange(prev, next)).toBe(expected);
  });
});
