import { fireEvent, render, screen } from '@testing-library/react';
import { advanceTo, clear } from 'jest-date-mock';
import React from 'react';

import { dateTime } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { DashboardScene } from '../scene/DashboardScene';

import { ShareImageTab } from './ShareImageTab';

describe('ShareLinkTab', () => {
  const fakeCurrentDate = dateTime('2019-02-11T19:00:00.000Z').toDate();

  global.fetch = jest.fn(() =>
    Promise.resolve({
      then: () => null,
    })
  ) as jest.Mock;

  afterAll(() => {
    clear();
  });

  beforeAll(() => {
    advanceTo(fakeCurrentDate);

    config.rendererAvailable = true;
    config.bootData.user.orgId = 1;
    config.featureToggles.dashboardSceneForViewers = true;
    config.featureToggles.sharePanelImageExportTab = true;
    config.featureToggles.scenes = true;
    locationService.push('/scenes/dashboard/dash-1?from=now-6h&to=now');
  });

  it('should prepare the image on download press', async () => {
    buildAndRenderScenario();

    fireEvent.click(await screen.findByRole('button'));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'render/d-solo/dash-1?panelId=12&width=1000&height=500&from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&tz=Pacific%2FEaster'
    );
  });

  it('should apply selected theme', async () => {
    buildAndRenderScenario();

    fireEvent.click(await screen.findByText('Dark'));
    fireEvent.click(await screen.findByRole('button'));

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'render/d-solo/dash-1?panelId=12&width=1000&height=500&from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&theme=dark&tz=Pacific%2FEaster'
    );
  });

  it('should apply width and height when inputs are modified', async () => {
    buildAndRenderScenario();

    fireEvent.change(await screen.findByTestId('image-width-input'), { target: { value: 555 } });
    fireEvent.change(await screen.findByTestId('image-height-input'), { target: { value: 444 } });
    fireEvent.click(await screen.findByRole('button'));

    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'render/d-solo/dash-1?panelId=12&width=555&height=444&from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&tz=Pacific%2FEaster'
    );
  });

  it('should not use absolute time range when lock time range is unchecked', async () => {
    buildAndRenderScenario();

    fireEvent.click(await screen.findByRole('checkbox', { checked: true }));
    fireEvent.click(await screen.findByRole('button'));

    expect(fetch).toHaveBeenNthCalledWith(
      4,
      'render/d-solo/dash-1?panelId=12&width=1000&height=500&tz=Pacific%2FEaster'
    );
  });

  it('should calculate width and height based on panel size when Use panel size is checked', async () => {
    buildAndRenderScenario();

    fireEvent.click(await screen.findByRole('checkbox', { checked: false }));
    fireEvent.click(await screen.findByRole('button'));

    const colWidth = (window.innerWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;

    const width = Math.floor(10 * colWidth);
    const height = Math.floor(12 * GRID_CELL_HEIGHT);

    expect(fetch).toHaveBeenNthCalledWith(
      5,
      `render/d-solo/dash-1?panelId=12&width=${width}&height=${height}&from=2019-02-11T13:00:00.000Z&to=2019-02-11T19:00:00.000Z&tz=Pacific%2FEaster`
    );
  });
});

function buildAndRenderScenario() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: panel,
        }),
      ],
    }),
  });

  const tab = new ShareImageTab({ dashboardRef: dashboard.getRef(), panelRef: panel.getRef() });

  render(<tab.Component model={tab} />);

  return tab;
}
