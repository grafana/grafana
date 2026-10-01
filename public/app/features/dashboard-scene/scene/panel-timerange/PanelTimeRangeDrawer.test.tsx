import { VizPanel } from '@grafana/scenes';
import { TimeCompareColorMode } from '@grafana/schema';

import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { PanelTimeRange } from './PanelTimeRange';
import { PanelTimeRangeDrawer } from './PanelTimeRangeDrawer';

interface SceneOptions {
  pluginId?: string;
  options?: Record<string, unknown>;
  compareWith?: string;
}

/**
 * The drawer reaches for its dashboard through the scene graph on apply, so the panel has to be
 * inside a real DashboardScene and the drawer has to be opened as its modal.
 */
function buildDrawerFor({ pluginId = 'timeseries', options = {}, compareWith = '1d' }: SceneOptions = {}) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId,
    options,
    $timeRange: new PanelTimeRange({ compareWith }),
  });

  const dashboard = new DashboardScene({
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  // The real call needs a loaded panel plugin to merge defaults against, which a unit test has no
  // reason to build. Spying keeps the assertions on what the drawer decides to write.
  const onOptionsChange = jest.spyOn(panel, 'onOptionsChange').mockImplementation(() => {});

  const drawer = new PanelTimeRangeDrawer({ panelRef: panel.getRef() });
  dashboard.showModal(drawer);

  return { drawer, panel, onOptionsChange };
}

describe('PanelTimeRangeDrawer comparison color mode', () => {
  it('seeds the drawer with the color mode already saved on the panel', () => {
    const { drawer } = buildDrawerFor({
      options: { timeCompare: { colorMode: TimeCompareColorMode.Inverted } },
    });

    expect(drawer.state.compareColorMode).toBe(TimeCompareColorMode.Inverted);
  });

  it('leaves the color mode unset for a panel that has never configured one', () => {
    const { drawer } = buildDrawerFor();

    expect(drawer.state.compareColorMode).toBeUndefined();
  });

  it('writes a newly picked color mode to the panel options on apply', () => {
    const { drawer, onOptionsChange } = buildDrawerFor();

    drawer.setState({ compareColorMode: TimeCompareColorMode.SameAsValue });
    drawer.onApply();

    expect(onOptionsChange).toHaveBeenCalledWith({
      timeCompare: { colorMode: TimeCompareColorMode.SameAsValue },
    });
  });

  // Applying the drawer for any other reason must not add an inert time comparison block to the
  // saved options of every panel it is opened on.
  it('does not write panel options when the color mode was not changed', () => {
    const { drawer, onOptionsChange } = buildDrawerFor({
      options: { timeCompare: { colorMode: TimeCompareColorMode.Inverted } },
    });

    drawer.setState({ timeFrom: '2h' });
    drawer.onApply();

    expect(onOptionsChange).not.toHaveBeenCalled();
  });
});
