import { createMemoryHistory } from 'history';
import { render, screen } from 'test/test-utils';

import { HistoryWrapper, config, locationService, setLocationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { NotebookToolbar } from './NotebookToolbar';

/**
 * Carries a real panel cell, not an empty layout. The export is the first caller of
 * transformNotebookSceneToSaveModel in production, so a scene with no cells would exercise the menu
 * without ever exercising the serializer or vizPanelToSchemaV2's constraints behind it.
 */
function buildScene() {
  return new NotebookScene({
    title: 'Q2 latency regression',
    uid: 'nb1',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'latency-panel',
          source: 'user',
          body: new VizPanel({ key: 'panel-1', title: 'p95 latency', pluginId: 'timeseries' }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookToolbar', () => {
  const originalLocationService = locationService;
  const originalAppUrl = config.appUrl;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    // Outside a secure context ClipboardButton falls back to document.execCommand, which jsdom
    // does not implement — the copy would fail silently and never reach the clipboard stub.
    Object.assign(window, { isSecureContext: true });
    config.appUrl = 'https://host/';
  });

  afterEach(() => {
    Object.assign(window, { isSecureContext: originalIsSecureContext });
    setLocationService(originalLocationService);
    config.appUrl = originalAppUrl;
  });

  /**
   * Renders, then installs a location service that carries an orgId, so the copied link has the
   * shape it has in production.
   *
   * The order matters: the test wrapper builds its own HistoryWrapper and calls setLocationService
   * while rendering, so anything installed beforehand is discarded. notebookShareUrl reads the
   * service when the button is clicked, not at render, so setting it afterwards is enough.
   */
  function setup() {
    const rendered = render(<NotebookToolbar uid="nb1" scene={buildScene()} />);

    const history = new HistoryWrapper(createMemoryHistory({ initialEntries: ['/'] }));
    history.setOrgIdGetter(() => 3);
    setLocationService(history);

    return rendered;
  }

  it('copies an absolute link to the notebook, not the in-app path', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // Both halves matter for a pasted link: the origin, or it is useless outside the app, and the
    // orgId, or it opens whichever org the reader happens to be in.
    expect(await navigator.clipboard.readText()).toBe('https://host/notebooks/nb1?orgId=3');
  });

  it('confirms the copy, so the single click does not look like it did nothing', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  // Drives the whole path the PR made live: scene -> transformNotebookSceneToSaveModel ->
  // vizPanelToSchemaV2 -> markdown. Asserting on the menu alone would pass with the serializer broken.
  it('copies markdown built from the scene, panel and all', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy as Markdown' }));

    const markdown = await navigator.clipboard.readText();
    expect(markdown).toContain('# Q2 latency regression');
    expect(markdown).toContain('### p95 latency');
    expect(markdown).toContain('_timeseries panel_');
  });

  it('offers the export actions from a dropdown', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Export/ }));

    expect(await screen.findByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in Cursor' })).toBeInTheDocument();
  });
});
