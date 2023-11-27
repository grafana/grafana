import { DashboardDataDTO } from 'app/types';

import dashboard_to_load from '../serialization/testfiles/dashboard_to_load1.json';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { dashboardSceneGraph } from './dashboardSceneGraph';

describe('dashboardSceneGraph', () => {
  describe('getTimePicker', () => {
    it('should return null if no time picker', () => {
      const dashboard: DashboardDataDTO = {
        ...(dashboard_to_load as unknown as DashboardDataDTO),
        timepicker: {
          hidden: true,
          collapse: false,
          refresh_intervals: [],
          time_options: [],
        },
      };

      const scene = transformSaveModelToScene({
        dashboard: dashboard as unknown as DashboardDataDTO,
        meta: {},
      });

      const timePicker = dashboardSceneGraph.getTimePicker(scene);
      expect(timePicker).toBeNull();
    });

    it('should return time picker', () => {
      const scene = transformSaveModelToScene({
        dashboard: dashboard_to_load as unknown as DashboardDataDTO,
        meta: {},
      });
      const timePicker = dashboardSceneGraph.getTimePicker(scene);
      expect(timePicker).not.toBeNull();
    });
  });
});
