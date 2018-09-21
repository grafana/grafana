import { SaveProvisionedDashboardModalCtrl } from '../save_provisioned_modal';

describe('SaveProvisionedDashboardModalCtrl', () => {
  const json = {
    title: 'name',
    id: 5,
  };

  const mockDashboardSrv = {
    getCurrent: () => {
      return {
        id: 5,
        meta: {},
        getSaveModelClone: () => {
          return json;
        },
      };
    },
  };

  const ctrl = new SaveProvisionedDashboardModalCtrl(mockDashboardSrv);

  it('should remove id from dashboard model', () => {
    expect(ctrl.dash.id).toBeUndefined();
  });

  it('should remove id from dashboard model in clipboard json', () => {
    expect(ctrl.getJsonForClipboard()).toBe(JSON.stringify({ title: 'name' }, null, 2));
  });
});
