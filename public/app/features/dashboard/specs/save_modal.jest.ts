import { SaveDashboardModalCtrl } from '../save_modal';
import { DashboardSrv } from '../dashboard_srv';

jest.mock('app/core/services/context_srv', () => ({}));

describe('SaveDashboardModal', () => {
  describe('save modal checkboxes', () => {
    /*let modal;
    beforeEach(() => {
      modal = new SaveDashboardModalCtrl(DashboardSrv);
      console.log(modal);
    });*/

    it('should hide checkboxes', () => {
      let modal = new SaveDashboardModalCtrl(DashboardSrv);
      console.log(DashboardSrv);
      expect(modal.compareTime()).toBe(true);
    });
  });
});
