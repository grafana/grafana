import { DashboardModel } from './DashboardModel';
import { appEvents } from '../../../core/core';
import { VariableChanged } from '../../variables/types';
import { PanelModel } from './PanelModel';

function getTestContext({
  usePanelInEdit,
  usePanelInView,
}: { usePanelInEdit?: boolean; usePanelInView?: boolean } = {}) {
  jest.clearAllMocks();

  const dashboard = new DashboardModel({});
  const startRefreshMock = jest.fn();
  dashboard.startRefresh = startRefreshMock;
  const panelInView = new PanelModel({ id: 99 });
  const panelInEdit = new PanelModel({ id: 100 });
  const panelIds = [1, 2, 3];
  if (usePanelInEdit) {
    dashboard.panelInEdit = panelInEdit;
    panelIds.push(panelInEdit.id);
  }
  if (usePanelInView) {
    dashboard.panelInView = panelInView;
    panelIds.push(panelInView.id);
  }

  appEvents.publish(new VariableChanged({ panelIds }));

  return { dashboard, startRefreshMock, panelInEdit, panelInView };
}

describe('Strict panel refresh', () => {
  describe('when there is no panel in full view or panel in panel edit during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { startRefreshMock } = getTestContext();

      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith([1, 2, 3]);
    });
  });

  describe('when there is a panel in full view during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { panelInView, startRefreshMock } = getTestContext({ usePanelInView: true });

      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith([1, 2, 3, panelInView.id]);
    });

    describe('and when exitViewPanel is called', () => {
      it('then all affected panels except the panel in full view should be refreshed', () => {
        const { dashboard, panelInView, startRefreshMock } = getTestContext({ usePanelInView: true });
        startRefreshMock.mockClear();

        dashboard.exitViewPanel(panelInView);

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith([1, 2, 3]);
        expect(dashboard['panelsAffectedByVariableChange']).toBeNull();
      });
    });
  });

  describe('when there is a panel in panel edit during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { panelInEdit, startRefreshMock } = getTestContext({ usePanelInEdit: true });
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith([1, 2, 3, panelInEdit.id]);
    });

    describe('and when exitViewPanel is called', () => {
      it('then all affected panels except the panel in panel edit should be refreshed', () => {
        const { dashboard, startRefreshMock } = getTestContext({ usePanelInEdit: true });
        startRefreshMock.mockClear();

        dashboard.exitPanelEditor();

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith([1, 2, 3]);
        expect(dashboard['panelsAffectedByVariableChange']).toBeNull();
      });
    });
  });
});
