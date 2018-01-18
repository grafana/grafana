import { describe, beforeEach, expect } from 'test/lib/common';

import { DashboardSrv } from '../dashboard_srv';

describe('dashboardSrv', function() {
  var _dashboardSrv;

  beforeEach(() => {
    _dashboardSrv = new DashboardSrv({}, {}, {});
  });

  it('should do something', () => {
    expect(_dashboardSrv).not.to.be(null);
  });
});
