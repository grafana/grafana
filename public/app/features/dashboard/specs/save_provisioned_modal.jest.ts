import { SaveProvisionedDashboardModalCtrl } from '../save_provisioned_modal';
import { describe, it, expect } from 'test/lib/common';

describe('SaveProvisionedDashboardModalCtrl', () => {
  var json = {
    title: 'name',
    id: 5,
  };

  var mockDashboardSrv = {
    getCurrent: function() {
      return {
        id: 5,
        meta: {},
        getSaveModelClone: function() {
          return json;
        },
      };
    },
  };

  var ctrl = new SaveProvisionedDashboardModalCtrl(mockDashboardSrv);

  it('verify that the id have been removed', () => {
    var copy = ctrl.getJsonForClipboard();
    expect(copy).toBe(`{"title":"name"}`);
  });
});
