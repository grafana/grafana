import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { advanceTo, clear } from 'jest-date-mock';

import { dateTime } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { LocalValueVariable, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { ShareLinkTab } from './ShareLinkTab';

jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createShortLink: jest.fn().mockResolvedValue(`http://localhost:3000/goto/shortend-uid`),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('ShareLinkTab', () => {
  const fakeCurrentDate = dateTime('2019-02-11T19:00:00.000Z').toDate();

  afterAll(() => {
    clear();
  });

  beforeAll(() => {
    advanceTo(fakeCurrentDate);

    config.appUrl = 'http://dashboards.grafana.com/grafana/';
    config.rendererAvailable = true;
    config.bootData.user.orgId = 1;
    config.featureToggles.dashboardSceneForViewers = true;
    locationService.push('/d/dash-1?from=now-6h&to=now');
  });

  describe('with locked time range (absolute) range', () => {
    it('should generate share url absolute time', async () => {
      buildAndRenderScenario({});

      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        'http://dashboards.grafana.com/grafana/d/dash-1?from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&viewPanel=A$panel-12'
      );
    });
  });

  describe('with disabled locked range range', () => {
    it('should generate share url with relative time', async () => {
      const tab = buildAndRenderScenario({});
      await act(() => tab.onToggleLockedTime());

      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        'http://dashboards.grafana.com/grafana/d/dash-1?from=now-6h&to=now&viewPanel=A$panel-12'
      );
    });
  });

  it('should add theme when specified', async () => {
    const tab = buildAndRenderScenario({});
    await act(() => tab.onThemeChange('light'));

    expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
      'http://dashboards.grafana.com/grafana/d/dash-1?from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&viewPanel=A$panel-12&theme=light'
    );
  });

  it('should shorten url', async () => {
    buildAndRenderScenario({});

    await userEvent.click(await screen.findByLabelText('Shorten URL'));

    expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
      `http://localhost:3000/goto/shortend-uid`
    );
  });

  it('should generate render url', async () => {
    buildAndRenderScenario({});

    expect(
      await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
    ).toHaveAttribute(
      'href',
      'http://dashboards.grafana.com/grafana/render/d-solo/dash-1?from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&panelId=panel-12&__feature.dashboardSceneSolo=true&width=1000&height=500&tz=Pacific%2FEaster'
    );
  });
});

interface ScenarioOptions {
  withPanel?: boolean;
}

function buildAndRenderScenario(options: ScenarioOptions) {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    $variables: new SceneVariableSet({
      variables: [
        new LocalValueVariable({
          name: 'server',
          value: 'A',
          text: 'A',
        }),
      ],
    }),
  });
  const tab = new ShareLinkTab({ panelRef: panel.getRef() });
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
