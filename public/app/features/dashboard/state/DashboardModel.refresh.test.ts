import { DashboardModel } from './DashboardModel';
import { appEvents } from '../../../core/core';
import { VariableChanged } from '../../variables/types';

function getTestContext({ panelInEdit, panelInView }: { panelInEdit?: any; panelInView?: any } = {}) {
  const dashboard = new DashboardModel({});
  dashboard.startRefresh = jest.fn();
  if (panelInEdit) {
    dashboard.panelInEdit = panelInEdit;
  }
  if (panelInView) {
    dashboard.panelInView = panelInView;
  }
  return { dashboard };
}

describe('Strict panel refresh', () => {
  describe('when strict panel is off', () => {
    it('then all panels should be refreshed', () => {
      const { dashboard } = getTestContext();

      appEvents.publish(new VariableChanged({ panelIds: [1, 2, 3] }));

      expect(dashboard.startRefresh).toHaveBeenCalledTimes(1);
      expect(dashboard.startRefresh).toHaveBeenLastCalledWith([1, 2, 3]);
    });
  });
});
