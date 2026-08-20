import { locationService } from '@grafana/runtime';
import { SceneDataTransformer } from '@grafana/scenes';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { syncTransformationsFromUrl, TRANSFORMATIONS_URL_PARAM } from './syncTransformationsFromUrl';

function buildScene() {
  return transformSaveModelToScene({
    dashboard: {
      title: 'test',
      uid: 'dash-1',
      schemaVersion: 38,
      panels: [
        {
          type: 'timeseries',
          id: 3,
          targets: [],
          transformations: [{ id: 'organize', options: {} }],
        },
        { type: 'timeseries', id: 4, targets: [] },
      ],
    } as unknown as DashboardDataDTO,
    meta: {},
  });
}

function getTransformer(scene: DashboardScene, key: string): SceneDataTransformer {
  const provider = findVizPanelByKey(scene, key)!.state.$data;

  if (!(provider instanceof SceneDataTransformer)) {
    throw new Error(`Expected SceneDataTransformer for ${key}`);
  }

  return provider;
}

function pushParam(value: unknown) {
  locationService.push(`/?${TRANSFORMATIONS_URL_PARAM}=${encodeURIComponent(JSON.stringify(value))}`);
}

describe('syncTransformationsFromUrl', () => {
  afterEach(() => {
    locationService.replace('/');
  });

  it('applies panel targeted transformations from the url', () => {
    pushParam({ '3': { prepend: [{ id: 'limit', options: {} }], append: [{ id: 'reduce', options: {} }] } });
    const scene = buildScene();
    const cleanup = syncTransformationsFromUrl(scene);

    expect(getTransformer(scene, 'panel-3').state.transformations).toEqual([
      { id: 'limit', options: {}, origin: 'url', position: 'prepend' },
      { id: 'organize', options: {} },
      { id: 'reduce', options: {}, origin: 'url', position: 'append' },
    ]);
    expect(getTransformer(scene, 'panel-4').state.transformations).toEqual([]);

    cleanup();
  });

  it('applies the array shorthand to all panels and clears when the param goes away', () => {
    pushParam([{ id: 'reduce', options: {} }]);
    const scene = buildScene();
    const cleanup = syncTransformationsFromUrl(scene);

    expect(getTransformer(scene, 'panel-3').state.transformations).toEqual([
      { id: 'organize', options: {} },
      { id: 'reduce', options: {}, origin: 'url', position: 'append' },
    ]);
    expect(getTransformer(scene, 'panel-4').state.transformations).toEqual([
      { id: 'reduce', options: {}, origin: 'url', position: 'append' },
    ]);

    locationService.push('/');

    expect(getTransformer(scene, 'panel-3').state.transformations).toEqual([{ id: 'organize', options: {} }]);
    expect(getTransformer(scene, 'panel-4').state.transformations).toEqual([]);

    cleanup();
  });

  it('ignores an invalid json param', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    locationService.push(`/?${TRANSFORMATIONS_URL_PARAM}=not-json`);
    const scene = buildScene();
    const cleanup = syncTransformationsFromUrl(scene);

    expect(getTransformer(scene, 'panel-3').state.transformations).toEqual([{ id: 'organize', options: {} }]);
    expect(warnSpy).toHaveBeenCalled();

    cleanup();
    warnSpy.mockRestore();
  });

  it('drops entries that are not transformer configs', () => {
    pushParam({ '3': { append: [{ id: 'reduce', options: {} }, { notATransform: true }, 'nope'] } });
    const scene = buildScene();
    const cleanup = syncTransformationsFromUrl(scene);

    expect(getTransformer(scene, 'panel-3').state.transformations).toEqual([
      { id: 'organize', options: {} },
      { id: 'reduce', options: {}, origin: 'url', position: 'append' },
    ]);

    cleanup();
  });
});
