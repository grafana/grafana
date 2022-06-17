import { appEvents } from '../../../core/core';
import { VariablesChanged } from '../../variables/types';
import { getTimeSrv, setTimeSrv } from '../services/TimeSrv';

import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';

function getTestContext({
  usePanelInEdit,
  usePanelInView,
  refreshAll = false,
}: { usePanelInEdit?: boolean; usePanelInView?: boolean; refreshAll?: boolean } = {}) {
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

  appEvents.publish(new VariablesChanged({ panelIds, refreshAll }));

  return { dashboard, startRefreshMock, panelInEdit, panelInView };
}

describe('Strict panel refresh', () => {
  describe('when there is no panel in full view or panel in panel edit during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { startRefreshMock } = getTestContext();

      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3], refreshAll: false });
    });
  });

  describe('when there is no panel in full view or panel in panel edit during variable change but refreshAll is true', () => {
    it('then all affected panels should be refreshed', () => {
      const { startRefreshMock } = getTestContext({ refreshAll: true });

      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [], refreshAll: true });
    });
  });

  describe('testing refresh threshold', () => {
    const originalTimeSrv = getTimeSrv();
    let isRefreshOutsideThreshold = false;

    beforeEach(() => {
      setTimeSrv({
        isRefreshOutsideThreshold: () => isRefreshOutsideThreshold,
      } as any);
    });

    afterEach(() => {
      setTimeSrv(originalTimeSrv);
    });

    describe('when the dashboard has not been refreshed within the threshold', () => {
      it(' then all panels should be refreshed', () => {
        isRefreshOutsideThreshold = true;
        const { startRefreshMock } = getTestContext();

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [], refreshAll: true });
      });
    });

    describe('when the dashboard has been refreshed within the threshold', () => {
      it('then all affected panels should be refreshed', () => {
        isRefreshOutsideThreshold = false;
        const { startRefreshMock } = getTestContext();

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3], refreshAll: false });
      });
    });

    describe('when the dashboard has been refreshed within the threshold but refreshAll is true', () => {
      it('then all affected panels should be refreshed', () => {
        isRefreshOutsideThreshold = false;
        const { startRefreshMock } = getTestContext({ refreshAll: true });

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [], refreshAll: true });
      });
    });
  });

  describe('when there is a panel in full view during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { panelInView, startRefreshMock } = getTestContext({ usePanelInView: true });

      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3, panelInView.id], refreshAll: false });
    });

    describe('and when exitViewPanel is called', () => {
      it('then all affected panels except the panel in full view should be refreshed', () => {
        const { dashboard, panelInView, startRefreshMock } = getTestContext({ usePanelInView: true });
        startRefreshMock.mockClear();

        dashboard.exitViewPanel(panelInView);

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3], refreshAll: false });
        expect(dashboard['panelsAffectedByVariableChange']).toBeNull();
      });
    });
  });

  describe('when there is a panel in panel edit during variable change', () => {
    it('then all affected panels should be refreshed', () => {
      const { panelInEdit, startRefreshMock } = getTestContext({ usePanelInEdit: true });
      expect(startRefreshMock).toHaveBeenCalledTimes(1);
      expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3, panelInEdit.id], refreshAll: false });
    });

    describe('and when exitViewPanel is called', () => {
      it('then all affected panels except the panel in panel edit should be refreshed', () => {
        const { dashboard, startRefreshMock } = getTestContext({ usePanelInEdit: true });
        startRefreshMock.mockClear();

        dashboard.exitPanelEditor();

        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenLastCalledWith({ panelIds: [1, 2, 3], refreshAll: false });
        expect(dashboard['panelsAffectedByVariableChange']).toBeNull();
      });
    });
  });
});
