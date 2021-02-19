import { SaveProvisionedDashboardModalCtrl } from './SaveProvisionedDashboardModalCtrl';

describe('SaveProvisionedDashboardModalCtrl', () => {
  const json = {
    title: 'name',
    id: 5,
  };

  const mockDashboardSrv: any = {
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
