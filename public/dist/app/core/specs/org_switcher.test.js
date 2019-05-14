import { OrgSwitchCtrl } from '../components/org_switcher';
import q from 'q';
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        user: { orgId: 1 },
    },
}); });
jest.mock('app/core/config', function () {
    return {
        appSubUrl: '/subUrl',
    };
});
describe('OrgSwitcher', function () {
    describe('when switching org', function () {
        var expectedHref;
        var expectedUsingUrl;
        beforeEach(function () {
            var backendSrvStub = {
                get: function (url) {
                    return q.resolve([]);
                },
                post: function (url) {
                    expectedUsingUrl = url;
                    return q.resolve({});
                },
            };
            var orgSwitcherCtrl = new OrgSwitchCtrl(backendSrvStub);
            orgSwitcherCtrl.setWindowLocation = function (href) { return (expectedHref = href); };
            return orgSwitcherCtrl.setUsingOrg({ orgId: 2 });
        });
        it('should switch orgId in call to backend', function () {
            expect(expectedUsingUrl).toBe('/api/user/using/2');
        });
        it('should switch orgId in url and redirect to home page', function () {
            expect(expectedHref).toBe('/subUrl/?orgId=2');
        });
    });
});
//# sourceMappingURL=org_switcher.test.js.map