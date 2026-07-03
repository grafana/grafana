import {
  ConstantVariable,
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';

import { tryGetExploreUrlForPanel } from './urlBuilders';

jest.mock('app/core/utils/explore', () => ({
  getExploreUrl: jest.fn().mockResolvedValue('/explore'),
}));

const getExploreUrlMock = jest.mocked(getExploreUrl);

describe('tryGetExploreUrlForPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(contextSrv, 'hasAccessToExplore').mockReturnValue(true);
  });

  it('interpolates a template-variable datasource ($datasource) to a concrete uid', async () => {
    const queryRunner = new SceneQueryRunner({
      queries: [{ refId: 'A', expr: 'up', datasource: { uid: '$datasource', type: '' } }],
    });
    const panel = new VizPanel({ pluginId: 'timeseries', $data: queryRunner });

    const scene = new EmbeddedScene({
      $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
      $variables: new SceneVariableSet({
        variables: [new ConstantVariable({ name: 'datasource', value: 'gdev-prometheus' })],
      }),
      body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: panel })] }),
    });
    scene.activate();

    await tryGetExploreUrlForPanel(panel);

    expect(getExploreUrlMock).toHaveBeenCalledTimes(1);
    const args = getExploreUrlMock.mock.calls[0][0];
    // Both the per-query datasource and the pane datasource must be resolved to a concrete uid,
    // not the raw `$datasource` variable, otherwise Explore cannot resolve the datasource.
    expect(args.queries[0].datasource).toMatchObject({ uid: 'gdev-prometheus' });
    expect(args.dsRef).toMatchObject({ uid: 'gdev-prometheus' });
  });

  it('leaves a concrete datasource uid unchanged', async () => {
    const queryRunner = new SceneQueryRunner({
      queries: [{ refId: 'A', expr: 'up', datasource: { uid: 'gdev-prometheus', type: 'prometheus' } }],
    });
    const panel = new VizPanel({ pluginId: 'timeseries', $data: queryRunner });

    const scene = new EmbeddedScene({
      $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
      body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: panel })] }),
    });
    scene.activate();

    await tryGetExploreUrlForPanel(panel);

    const args = getExploreUrlMock.mock.calls[0][0];
    expect(args.queries[0].datasource).toMatchObject({ uid: 'gdev-prometheus', type: 'prometheus' });
    expect(args.dsRef).toMatchObject({ uid: 'gdev-prometheus' });
  });
});
