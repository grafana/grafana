import { SceneGridItem, SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel, behaviors } from '@grafana/scenes';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { ignoreChanges } from './DashboardPrompt';

function getTestContext() {
  const contextSrv = { isSignedIn: true, isEditor: true } as ContextSrv;
  setContextSrv(contextSrv);

  return { contextSrv };
}

describe('DashboardPrompt', () => {
  describe('ignoreChanges', () => {
    beforeEach(() => {
      getTestContext();
    });

    describe('when called without original dashboard', () => {
      it('then it should return true', () => {
        const scene = buildTestScene();
        expect(ignoreChanges(scene, undefined)).toBe(true);
      });
    });

    describe('when called without current dashboard', () => {
      it('then it should return true', () => {
        const scene = buildTestScene();
        expect(ignoreChanges(null, scene.getInitialSaveModel())).toBe(true);
      });
    });

    describe('when called for a viewer without save permissions', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const scene = buildTestScene({
          meta: {
            canSave: false,
          },
        });
        contextSrv.isEditor = false;

        expect(ignoreChanges(scene, scene.getInitialSaveModel())).toBe(true);
      });
    });

    describe('when called for a viewer with save permissions', () => {
      it('then it should return undefined', () => {
        const { contextSrv } = getTestContext();

        const scene = buildTestScene({
          meta: {
            canSave: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);

        contextSrv.isEditor = false;

        expect(ignoreChanges(scene, initialSaveModel)).toBe(undefined);
      });
    });

    describe('when called for an user that is not signed in', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const scene = buildTestScene({
          meta: {
            canSave: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);

        contextSrv.isSignedIn = false;
        expect(ignoreChanges(scene, initialSaveModel)).toBe(true);
      });
    });

    describe('when called with fromScript', () => {
      it('then it should return true', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        expect(ignoreChanges(scene, initialSaveModel)).toBe(true);
      });
    });

    describe('when called with fromFile', () => {
      it('then it should return true', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: undefined,
            fromFile: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        expect(ignoreChanges(scene, initialSaveModel)).toBe(true);
      });
    });

    describe('when called with canSave but without fromScript and fromFile', () => {
      it('then it should return false', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: undefined,
            fromFile: undefined,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        expect(ignoreChanges(scene, initialSaveModel)).toBe(undefined);
      });
    });
  });
});

function buildTestScene(overrides?: Partial<DashboardSceneState>) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
    }),
    controls: new DashboardControls({}),
    $behaviors: [new behaviors.CursorSync({})],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
      ],
    }),
    ...overrides,
  });

  return scene;
}
