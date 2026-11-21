import { waitFor } from 'test/test-utils';

import {
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelInteraction,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { DashboardScene } from '../../DashboardScene';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { promoteAdHocChanges } from './promoteAdHocChanges';

const hideColumn = [{ id: 'organize', options: { excludeByName: { a: true } } }];
const context = { elementKey: 'panel-1', transformations: hideColumn };

const promotions: Record<string, jest.Mock> = {
  first: jest.fn(),
  second: jest.fn(),
};

const deactivate: Array<() => void> = [];

function interaction(name: string): PanelInteraction {
  return { id: 0, name, mutates: ['TRANSFORMATION'], schema: [], promotionHandler: promotions[name] };
}

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(
      getPanelPlugin({ id: 'table' }).setPanelInteractions({
        interactions: [interaction('first'), interaction('second')],
      })
    ),
  getPanelPluginFromCache: () => undefined,
});

async function buildScene(version: 'v1' | 'v2' = 'v2', series?: DataFrame[], state = LoadingState.Done) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    $data:
      series &&
      new SceneDataTransformer({
        $data: new SceneDataNode({ data: { series, state, timeRange: getDefaultTimeRange() } }),
        transformations: [],
      }),
  });
  const dashboard = new DashboardScene(
    {
      title: 'My dashboard',
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    version
  );
  // Loaded dashboards keep the JSON they were built from.
  dashboard.serializer.initialSaveModel = dashboard.getSaveModel();
  deactivate.push(activateFullSceneTree(dashboard));
  await waitFor(() => {
    expect(panel.getPlugin()?.panelInteractions?.interactions).toHaveLength(2);
  });
  panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideColumn);
  return { panel, dashboard };
}

describe('promoteAdHocChanges', () => {
  beforeEach(() => {
    promotions.first.mockReset().mockImplementation((json) => ({ ...json, title: `${json.title} (promoted)` }));
    promotions.second.mockReset().mockImplementation((json) => json);
  });

  afterEach(() => {
    deactivate
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup());
  });

  it('passes the v2 dashboard JSON, the panel element key and its ad hoc transformations to the first promotion handler', async () => {
    const { panel } = await buildScene();

    promoteAdHocChanges(panel);

    expect(promotions.first).toHaveBeenCalledTimes(1);
    expect(promotions.first).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My dashboard', elements: expect.any(Object) }),
      context
    );
  });

  it('feeds each promotion the JSON returned by the previous one and returns the last result', async () => {
    const { panel } = await buildScene();

    const result = promoteAdHocChanges(panel);

    expect(promotions.second).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My dashboard (promoted)' }),
      context
    );
    expect(result).toMatchObject({ title: 'My dashboard (promoted)' });
  });

  describe('with panel data', () => {
    const series = [toDataFrame({ fields: [{ name: 'a', type: FieldType.string, values: ['x'] }] })];

    async function buildSceneWithAdHocChanges(
      transformations: Array<{ id: string; options: object }>,
      state = LoadingState.Done
    ) {
      const { panel } = await buildScene('v2', series, state);
      panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, transformations);
      await waitFor(() => {
        expect(panel.getRuntimeTransformations().getSourceSeries(TABLE_TRANSFORMATIONS_OWNER)).toHaveLength(1);
      });
      return panel;
    }

    it('passes only the ad hoc changes that still apply to the panel data', async () => {
      const panel = await buildSceneWithAdHocChanges([
        { id: 'organize', options: { excludeByName: { a: true, gone: true } } },
        { id: 'organize', options: { indexByName: { gone: 0, a: 1 } } },
      ]);

      promoteAdHocChanges(panel);

      expect(promotions.first).toHaveBeenCalledWith(expect.anything(), {
        elementKey: 'panel-1',
        transformations: [{ id: 'organize', options: { excludeByName: { a: true } } }],
      });
    });

    it('keeps the ad hoc changes of a query whose frame has not arrived while the panel data is loading', async () => {
      const otherQuery = {
        id: 'organize',
        options: { excludeByName: { a: true } },
        filter: { id: 'byRefId', options: 'B' },
      };
      const panel = await buildSceneWithAdHocChanges([otherQuery], LoadingState.Loading);

      promoteAdHocChanges(panel);

      expect(promotions.first).toHaveBeenCalledWith(expect.anything(), {
        elementKey: 'panel-1',
        transformations: [otherQuery],
      });
    });

    it('does not promote when none of the ad hoc changes apply to the panel data', async () => {
      const panel = await buildSceneWithAdHocChanges([{ id: 'organize', options: { excludeByName: { gone: true } } }]);

      const result = promoteAdHocChanges(panel);

      expect(result).toBeUndefined();
      expect(promotions.first).not.toHaveBeenCalled();
      expect(promotions.second).not.toHaveBeenCalled();
    });
  });

  it('does not promote into a v1 dashboard', async () => {
    const { panel } = await buildScene('v1');

    const result = promoteAdHocChanges(panel);

    expect(result).toBeUndefined();
    expect(promotions.first).not.toHaveBeenCalled();
    expect(promotions.second).not.toHaveBeenCalled();
  });
});
