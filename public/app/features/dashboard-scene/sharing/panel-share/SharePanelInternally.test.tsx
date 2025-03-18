import { render, screen } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
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

const selector = e2eSelectors.pages.ShareDashboardDrawer.ShareInternally.SharePanel;

describe('SharePanelInternally', () => {
  it('should disable all image generation inputs when renderer is not available', async () => {
    config.rendererAvailable = false;
    buildAndRenderScenario();

    expect(await screen.findByTestId(selector.preview)).toBeInTheDocument();
    [
      selector.widthInput,
      selector.heightInput,
      selector.scaleFactorInput,
      selector.generateImageButton,
      selector.downloadImageButton,
    ].forEach((selector) => {
      expect(screen.getByTestId(selector)).toBeDisabled();
    });
  });

  it('should enable all image generation inputs when renderer is available', async () => {
    config.rendererAvailable = true;
    buildAndRenderScenario();

    expect(await screen.findByTestId(selector.preview)).toBeInTheDocument();
    [selector.widthInput, selector.heightInput, selector.scaleFactorInput].forEach((selector) => {
      expect(screen.getByTestId(selector)).toBeEnabled();
    });

    await userEvent.type(screen.getByTestId(selector.widthInput), '1000');
    await userEvent.type(screen.getByTestId(selector.widthInput), '2000');
    expect(screen.getByTestId(selector.generateImageButton)).toBeEnabled();
    expect(screen.getByTestId(selector.downloadImageButton)).toBeDisabled();
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
