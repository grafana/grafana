import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { DashboardScene } from '../../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelMenuBehavior } from '../../scene/PanelMenuBehavior';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { HelpWizard } from './HelpWizard';

jest.mock('./utils.ts', () => ({
  ...jest.requireActual('./utils.ts'),
  getGithubMarkdown: () => new Uint8Array(1024 * 1024).toString(),
}));

async function setup() {
  const { panel } = await buildTestScene();
  panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

  return render(<HelpWizard panel={panel} onClose={() => {}} />);
}

describe('HelpWizard', () => {
  it('should render support bundle info if user has support bundle access', async () => {
    config.supportBundlesEnabled = true;
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    setup();
    expect(await screen.findByText(/You can also retrieve a support bundle/)).toBeInTheDocument();
  });

  it('should not render support bundle info if user does not have support bundle access', async () => {
    config.supportBundlesEnabled = false;
    setup();

    expect(screen.queryByText('You can also retrieve a support bundle')).not.toBeInTheDocument();
  });

  it('should show error as alert', async () => {
    setup();
    await userEvent.click(await screen.findByTestId('data-testid Tab Data'));
    await userEvent.click((await screen.findAllByText('Copy to clipboard'))[0]);
    expect(await screen.findByText(/Snapshot is too large/)).toBeInTheDocument();
  });

  describe('support tab', () => {
    it('should render', async () => {
      setup();
      expect(await screen.findByText(/Modify the original data to hide sensitive information/)).toBeInTheDocument();
    });
  });

  describe('data tab', () => {
    it('should show "copy to clipboard" button if template is "GitHub comment"', async () => {
      setup();
      await userEvent.click(await screen.findByTestId('data-testid Tab Data'));
      expect(await screen.findByText('Copy to clipboard')).toBeInTheDocument();
    });

    it('should show download button for other templates', async () => {
      setup();
      await userEvent.click(await screen.findByTestId('data-testid Tab Data'));
      await userEvent.click(await screen.findByRole('combobox'));
      await userEvent.click(await screen.findByText(/Panel support snapshot/));
      expect(await screen.findByText(/^Download/)).toBeInTheDocument();
    });
  });
});

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
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  await new Promise((r) => setTimeout(r, 1));

  return { scene, panel, menu };
}
