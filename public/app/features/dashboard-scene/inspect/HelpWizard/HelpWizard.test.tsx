import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import {
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelMenuBehavior } from '../../scene/PanelMenuBehavior';

import { HelpWizard } from './HelpWizard';

async function setup() {
  const { panel } = await buildTestScene();
  panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

  return render(<HelpWizard panel={panel} onClose={() => {}} />);
}
describe('SupportSnapshot', () => {
  it('Can render', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Dashboard (3.50 KiB)' })).toBeInTheDocument();
  });
});

async function buildTestScene() {
  const menu = new VizPanelMenu({
    $behaviors: [panelMenuBehavior],
  });

  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'timeseries',
    key: 'panel-12',
    menu,
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    $data: new SceneQueryRunner({
      data: {
        state: LoadingState.Done,
        series: [
          toDataFrame({
            name: 'http_requests_total',
            fields: [
              { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
              { name: 'Value', type: FieldType.number, values: [11, 22, 33] },
            ],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
      datasource: { uid: 'my-uid' },
      queries: [{ query: 'QueryA', refId: 'A' }],
    }),
  });

  const scene = new DashboardScene({
    title: 'My dashboard',
    uid: 'dash-1',
    tags: ['database', 'panel'],
    $timeRange: new SceneTimeRange({
      from: 'now-5m',
      to: 'now',
      timeZone: 'Africa/Abidjan',
    }),
    meta: {
      canEdit: true,
      isEmbedded: false,
    },
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

  await new Promise((r) => setTimeout(r, 1));

  return { scene, panel, menu };
}
