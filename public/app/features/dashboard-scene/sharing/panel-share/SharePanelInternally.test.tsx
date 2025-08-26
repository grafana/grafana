import { render, screen } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { userEvent } from '../../../../../test/test-utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { SharePanelInternally } from './SharePanelInternally';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('SharePanelInternally', () => {
  it('should disable all image generation inputs when renderer is not available', async () => {
    config.rendererAvailable = false;
    buildAndRenderScenario();

    // Check that the panel preview is rendered
    expect(await screen.findByText('Panel preview')).toBeInTheDocument();

    // All inputs should be disabled - use placeholder text to find inputs
    expect(screen.getByPlaceholderText('1000')).toBeDisabled(); // Width input
    expect(screen.getByPlaceholderText('500')).toBeDisabled(); // Height input
    expect(screen.getByPlaceholderText('1')).toBeDisabled(); // Scale factor input
    expect(screen.getByRole('button', { name: /generate image/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /download image/i })).toBeDisabled();
  });

  it('should enable all image generation inputs when renderer is available', async () => {
    config.rendererAvailable = true;
    buildAndRenderScenario();

    // Check that the panel preview is rendered
    expect(await screen.findByText('Panel preview')).toBeInTheDocument();

    // Form inputs should be enabled
    expect(screen.getByPlaceholderText('1000')).toBeEnabled(); // Width input
    expect(screen.getByPlaceholderText('500')).toBeEnabled(); // Height input
    expect(screen.getByPlaceholderText('1')).toBeEnabled(); // Scale factor input

    // Test form interaction
    const widthInput = screen.getByPlaceholderText('1000');
    const heightInput = screen.getByPlaceholderText('500');

    await userEvent.clear(widthInput);
    await userEvent.type(widthInput, '1000');
    await userEvent.clear(heightInput);
    await userEvent.type(heightInput, '2000');

    expect(screen.getByRole('button', { name: /generate image/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /download image/i })).toBeDisabled();
  });
});

function buildAndRenderScenario() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });
  const tab = new SharePanelInternally({ panelRef: panel.getRef() });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    overlay: tab,
  });

  activateFullSceneTree(scene);

  render(<tab.Component model={tab} />);

  return tab;
}
