import { DashboardDataDTO } from 'app/types';

import { DashboardLinksControls } from '../scene/DashboardLinksControls';
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

  describe('getDashboardLinks', () => {
    it('should return DashboardLinksControls', () => {
      const dashboardWithLinks: DashboardDataDTO = {
        ...(dashboard_to_load as unknown as DashboardDataDTO),
        links: [
          {
            asDropdown: false,
            icon: 'external link',
            includeVars: false,
            keepTime: false,
            tags: [],
            targetBlank: false,
            title: 'test',
            tooltip: 'test',
            type: 'link',
          },
        ],
      };

      const sceneWithoutLinks = transformSaveModelToScene({
        dashboard: dashboard_to_load as unknown as DashboardDataDTO,
        meta: {},
      });
      const sceneWithLinks = transformSaveModelToScene({
        dashboard: dashboardWithLinks,
        meta: {},
      });

      const linksControls1 = dashboardSceneGraph.getDashboardLinks(sceneWithoutLinks);
      expect(linksControls1).not.toBeNull();
      expect(linksControls1).toBeInstanceOf(DashboardLinksControls);
      expect(linksControls1?.state.links.length).toBe(0);

      const linksControls2 = dashboardSceneGraph.getDashboardLinks(sceneWithLinks);
      expect(linksControls2).not.toBeNull();
      expect(linksControls2).toBeInstanceOf(DashboardLinksControls);
      expect(linksControls2?.state.links.length).toBe(1);
    });
  });
});
