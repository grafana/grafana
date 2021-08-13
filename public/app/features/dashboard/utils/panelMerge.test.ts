import { PanelModel } from '../../../../../packages/grafana-data/src';
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
        }
      `);
    });
  });
});
