import { SceneGridItem, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { defaultDashboard } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';

describe('transformSceneToSaveModel', () => {
  describe('Given simple scene', () => {
    it('Should transfrom back to peristed model', () => {
      const scene = buildBaseTestScene();
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toEqual({
        title: 'Test Dashboard',
        uid: 'cool-uid-123',
        editable: true,
        fiscalYearStartMonth: 0,
        links: [],
        graphTooltip: 0,
        tags: [],
        timezone: 'browser',
        style: 'dark',
        schemaVersion: defaultDashboard.schemaVersion,
        time: {
          from: 'now-5m',
          to: 'now',
        },
        panels: [
          {
            id: 12,
            title: 'Title',
            type: 'timeseries',
            options: {
              showLegend: false,
            },
            fieldConfig: {
              defaults: { min: 10 },
              overrides: [],
            },
            transparent: false,
            transformations: [],
            gridPos: { x: 1, y: 2, w: 10, h: 20 },
          },
        ],
      });
    });
  });
});

function buildBaseTestScene(): DashboardScene {
  return new DashboardScene({
    title: 'Test Dashboard',
    uid: 'cool-uid-123',
    $timeRange: new SceneTimeRange({
      from: 'now-5m',
      to: 'now',
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-12',
          x: 1,
          y: 2,
          width: 10,
          height: 20,
          body: new VizPanel({
            key: 'panel-12',
            pluginId: 'timeseries',
            options: {
              showLegend: false,
              infinity: -Infinity,
              null: null,
            },
            fieldConfig: {
              defaults: { min: 10 },
              overrides: [],
            },
          }),
        }),
      ],
    }),
  });
}
