import { PanelModel } from '@grafana/data';
import { FieldColorModeId, ThresholdsMode } from '@grafana/schema/src';

import { DashboardModel } from '../state/DashboardModel';
import { createDashboardModelFixture, createPanelSaveModel } from '../state/__fixtures__/dashboardFixtures';

// skipping these tests because panelMerge is not used
describe.skip('Merge dashboard panels', () => {
  describe('simple changes', () => {
    let dashboard: DashboardModel;
    let rawPanels: PanelModel[];

    beforeEach(() => {
      dashboard = createDashboardModelFixture({
        title: 'simple title',
        panels: [
          createPanelSaveModel({
            id: 1,
            type: 'timeseries',
          }),
          createPanelSaveModel({
            id: 2,
            type: 'timeseries',
          }),
          createPanelSaveModel({
            id: 3,
            type: 'table',
            fieldConfig: {
              defaults: {
                thresholds: {
                  mode: ThresholdsMode.Absolute,
                  steps: [
                    { color: 'green', value: -Infinity }, // save model has this as null
                    { color: 'red', value: 80 },
                  ],
                },
                mappings: [],
                color: { mode: FieldColorModeId.Thresholds },
              },
              overrides: [],
            },
          }),
        ],
      });
      rawPanels = dashboard.getSaveModelCloneOld().panels;
    });

    it('should load and support noop', () => {
      expect(dashboard.title).toBe('simple title');
      expect(dashboard.panels.length).toEqual(rawPanels.length);

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeFalsy();
      expect(info.actions).toMatchInlineSnapshot(`
        {
          "add": [],
          "noop": [
            1,
            2,
            3,
          ],
          "remove": [],
          "replace": [],
          "update": [],
        }
      `);
    });

    it('should identify an add', () => {
      rawPanels.push({
        id: 7,
        type: 'canvas',
      } as PanelModel);

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeTruthy();
      expect(info.actions['add']).toEqual([7]);
    });

    it('should identify a remove', () => {
      rawPanels.shift();

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeTruthy();
      expect(info.actions['remove']).toEqual([1]);
    });

    it('should allow change in key order for nested elements', () => {
      rawPanels[2].fieldConfig = {
        defaults: {
          color: { mode: 'thresholds' },
          mappings: [],
          thresholds: {
            steps: [
              { color: 'green', value: -Infinity },
              { color: 'red', value: 80 },
            ],
            mode: ThresholdsMode.Absolute,
          },
        },
        overrides: [],
      };

      // Same config, different order
      const js0 = JSON.stringify(dashboard.panels[2].fieldConfig);
      const js1 = JSON.stringify(rawPanels[2].fieldConfig);
      expect(js1).not.toEqual(js0);
      expect(js1.length).toEqual(js0.length);

      // no real changes here
      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeFalsy();
    });

    it('should replace a type change', () => {
      rawPanels[1].type = 'canvas';

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeTruthy();
      expect(info.actions).toMatchInlineSnapshot(`
        {
          "add": [],
          "noop": [
            1,
            3,
          ],
          "remove": [],
          "replace": [
            2,
          ],
          "update": [],
        }
      `);
    });
  });
});
