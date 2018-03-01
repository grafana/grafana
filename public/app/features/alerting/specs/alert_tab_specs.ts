import { describe, it, expect } from 'test/lib/common';

import { AlertTabCtrl } from '../alert_tab_ctrl';

describe('AlertTabCtrl', () => {
  var $scope = {
    ctrl: {},
  };

  describe('with null parameters', () => {
    it('can be created', () => {
      var alertTab = new AlertTabCtrl($scope, null, null, null, null, null);

      expect(alertTab).to.not.be(null);
    });
  });
});
