import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../utils/interactions';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
  ScenePanelLinksEditor,
} from './getPanelFrameOptions';

jest.mock('app/features/dashboard/components/GenAI/LazyGenAIButtons', () => ({
  LazyGenAIPanelTitleButton: () => null,
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function setup() {
  const links = new VizPanelLinks({
    rawLinks: [
      { title: 'Docs', url: '/docs' },
      { title: 'Runbook', url: '/runbook' },
    ],
    menu: new VizPanelLinksMenu({}),
  });
  const panel = new VizPanel({
    key: 'panel-2',
    title: 'Original title',
    description: 'Original description',
    pluginId: 'timeseries',
    titleItems: [links],
  });
  new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  return { panel, links };
}

const fromEditPane = { source: 'edit_pane', panel_type: 'timeseries', panel_id: 2 };

describe('panel frame option tracking', () => {
  let panelSettingChanged: jest.SpyInstance;

  beforeEach(() => {
    panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged').mockImplementation();
  });

  afterEach(() => {
    panelSettingChanged.mockRestore();
  });

  it('reports a title change once, when the input loses focus', async () => {
    const { panel } = setup();
    render(<PanelFrameTitleInput panel={panel} />);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'New title');
    expect(panelSettingChanged).not.toHaveBeenCalled();
    await userEvent.tab();

    expect(panelSettingChanged).toHaveBeenCalledTimes(1);
    expect(panelSettingChanged).toHaveBeenCalledWith({ item: 'change_panel_title', ...fromEditPane });
  });

  it('does not report a title that was focused and left unchanged', async () => {
    const { panel } = setup();
    render(<PanelFrameTitleInput panel={panel} />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    expect(panel.state.title).toBe('Original title');
    expect(panelSettingChanged).not.toHaveBeenCalled();
  });

  it('reports a description change when the field loses focus', async () => {
    const { panel } = setup();
    render(<PanelDescriptionTextArea panel={panel} />);

    await userEvent.type(screen.getByRole('textbox'), ' more');
    await userEvent.tab();

    expect(panelSettingChanged).toHaveBeenCalledWith({ item: 'change_panel_description', ...fromEditPane });
  });

  it('does not report a description that was focused and left unchanged', async () => {
    const { panel } = setup();
    render(<PanelDescriptionTextArea panel={panel} />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();

    expect(panel.state.description).toBe('Original description');
    expect(panelSettingChanged).not.toHaveBeenCalled();
  });

  it('reports switching the description to a subtitle', async () => {
    const { panel } = setup();
    render(<PanelDescriptionTextArea panel={panel} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(panelSettingChanged).toHaveBeenCalledWith({ item: 'toggle_panel_subtitle', ...fromEditPane });
  });

  it('reports a transparent background change', async () => {
    const { panel } = setup();
    render(<PanelBackgroundSwitch panel={panel} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(panelSettingChanged).toHaveBeenCalledWith({ item: 'change_panel_background', ...fromEditPane });
  });

  it('reports removing a panel link', async () => {
    const { panel, links } = setup();
    const { container } = render(<ScenePanelLinksEditor panel={panel} panelLinks={links} />);
    // The sortable list ignores clicks until its drag handles are registered.
    await waitFor(() => {
      expect(container.querySelectorAll('[data-rfd-drag-handle-draggable-id]')).toHaveLength(2);
    });

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(links.state.rawLinks).toEqual([{ title: 'Runbook', url: '/runbook' }]);
    expect(panelSettingChanged).toHaveBeenCalledWith({ item: 'remove_panel_link', ...fromEditPane });
  });
});
