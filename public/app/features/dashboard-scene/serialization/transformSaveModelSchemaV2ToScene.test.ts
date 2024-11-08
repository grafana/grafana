import { QueryVariable, TextBoxVariable } from '@grafana/scenes';
import { DashboardV2 } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { fullDashboardV2 } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/mocks';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';

const defaultDashboard: DashboardV2 = fullDashboardV2;

describe('transformSaveModelSchemaV2ToScene', () => {
  describe('when creating dashboard scene', () => {
    it('should initialize the DashboardScene with the model state', () => {
      const dash = { ...defaultDashboard, title: 'test', uid: 'test-uid' };
      const time = defaultDashboard.spec.timeSettings ?? {};

      const scene = transformSaveModelSchemaV2ToScene(dash);
      const dashboardControls = scene.state.controls!;

      expect(scene.state.title).toBe('test');
      expect(scene.state.uid).toBe('test-uid');
      expect(scene.state.links).toHaveLength(1);
      expect(scene.state.links![0].title).toBe(dash.spec.links[0].title);
      expect(scene.state?.$timeRange?.state.value.raw).toEqual({ from: time.from, to: time.to });
      expect(scene.state?.$timeRange?.state.fiscalYearStartMonth).toEqual(time.fiscalYearStartMonth);
      expect(scene.state?.$timeRange?.state.timeZone).toEqual(time.timezone);
      expect(scene.state?.$timeRange?.state.weekStart).toEqual(time.weekStart);

      expect(scene.state?.$variables?.state.variables).toHaveLength(dash.spec.variables.length);
      expect(scene.state?.$variables?.getByName(dash.spec.variables[0].spec.name)).toBeInstanceOf(QueryVariable);
      expect(scene.state?.$variables?.getByName(dash.spec.variables[1].spec.name)).toBeInstanceOf(TextBoxVariable);

      expect(dashboardControls).toBeDefined();

      expect(dashboardControls.state.refreshPicker.state.intervals).toEqual(time.autoRefreshIntervals);
      expect(dashboardControls.state.hideTimeControls).toBe(time.hideTimepicker);
    });

    // it('should apply cursor sync behavior', () => {
    //   const dash = {
    //     ...defaultDashboard,
    //     title: 'Test dashboard',
    //     uid: 'test-uid',
    //     graphTooltip: DashboardCursorSync.Crosshair,
    //   };
    //   const oldModel = new DashboardModel(dash);

    //   const scene = createDashboardSceneFromDashboardModel(oldModel, dash);

    //   const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);
    //   expect(cursorSync).toBeInstanceOf(behaviors.CursorSync);
    //   expect((cursorSync as behaviors.CursorSync).state.sync).toEqual(DashboardCursorSync.Crosshair);
    // });

    // it('should apply live now timer behavior', () => {
    //   const dash = {
    //     ...defaultDashboard,
    //     title: 'Test dashboard',
    //     uid: 'test-uid',
    //   };
    //   const oldModel = new DashboardModel(dash);
    //   const scene = createDashboardSceneFromDashboardModel(oldModel, dash);

    //   const liveNowTimer = scene.state.$behaviors?.find((b) => b instanceof behaviors.LiveNowTimer);
    //   expect(liveNowTimer).toBeInstanceOf(behaviors.LiveNowTimer);
    // });

    // it('should initialize the Dashboard Scene with empty template variables', () => {
    //   const dash = {
    //     ...defaultDashboard,
    //     title: 'test empty dashboard with no variables',
    //     uid: 'test-uid',
    //     time: { from: 'now-10h', to: 'now' },
    //     weekStart: 'saturday',
    //     fiscalYearStartMonth: 2,
    //     timezone: 'America/New_York',
    //     templating: {
    //       list: [],
    //     },
    //   };
    //   const oldModel = new DashboardModel(dash);

    //   const scene = createDashboardSceneFromDashboardModel(oldModel, dash);
    //   expect(scene.state.$variables?.state.variables).toBeDefined();
    // });
  });
});
