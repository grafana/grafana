import { OrgSwitchCtrl } from '../components/org_switcher';
import q from 'q';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

jest.mock('app/core/config', () => {
  return {
    appSubUrl: '/subUrl',
  };
});

describe('OrgSwitcher', () => {
  describe('when switching org', () => {
    let expectedHref;
    let expectedUsingUrl;

    beforeEach(() => {
      const backendSrvStub: any = {
        get: url => {
          return q.resolve([]);
        },
        post: url => {
          expectedUsingUrl = url;
          return q.resolve({});
        },
      };

      const orgSwitcherCtrl = new OrgSwitchCtrl(backendSrvStub);

      orgSwitcherCtrl.setWindowLocation = href => (expectedHref = href);

      return orgSwitcherCtrl.setUsingOrg({ orgId: 2 });
    });

    it('should switch orgId in call to backend', () => {
      expect(expectedUsingUrl).toBe('/api/user/using/2');
    });

    it('should switch orgId in url and redirect to home page', () => {
      expect(expectedHref).toBe('/subUrl/?orgId=2');
    });
  });
});
