import { PanelModel } from '@grafana/data';

import { DashboardModel } from '../state/DashboardModel';

describe('Merge dashbaord panels', () => {
  describe('simple changes', () => {
    let dashboard: DashboardModel;
    let rawPanels: PanelModel[];

    beforeEach(() => {
      dashboard = new DashboardModel({
        title: 'simple title',
        panels: [
          {
            id: 1,
            type: 'timeseries',
          },
          {
            id: 2,
            type: 'timeseries',
          },
          {
            id: 3,
            type: 'table',
            fieldConfig: {
              defaults: {
                thresholds: {
                  mode: 'absolute',
                  steps: [
                    { color: 'green', value: -Infinity }, // save model has this as null
                    { color: 'red', value: 80 },
                  ],
                },
                mappings: [],
                color: { mode: 'thresholds' },
              },
              overrides: [],
            },
          },
        ],
      });
      rawPanels = dashboard.getSaveModelClone().panels;
    });

    it('should load and support noop', () => {
      expect(dashboard.title).toBe('simple title');
      expect(dashboard.panels.length).toEqual(rawPanels.length);

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeFalsy();
      expect(info.actions).toMatchInlineSnapshot(`
        Object {
          "add": Array [],
          "noop": Array [
            1,
            2,
            3,
          ],
          "remove": Array [],
          "replace": Array [],
          "update": Array [],
        }
      `);
    });

    it('should identify an add', () => {
      rawPanels.push({
        id: 7,
        type: 'canvas',
      } as any);

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
      (rawPanels[2] as any).fieldConfig = {
        defaults: {
          color: { mode: 'thresholds' },
          mappings: [],
          thresholds: {
            steps: [
              { color: 'green', value: null },
              { color: 'red', value: 80 },
            ],
            mode: 'absolute',
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
      (rawPanels[1] as any).type = 'canvas';

      const info = dashboard.updatePanels(rawPanels);
      expect(info.changed).toBeTruthy();
      expect(info.actions).toMatchInlineSnapshot(`
        Object {
          "add": Array [],
          "noop": Array [
            1,
            3,
          ],
          "remove": Array [],
          "replace": Array [
            2,
          ],
          "update": Array [],
        }
      `);
    });
  });
});
