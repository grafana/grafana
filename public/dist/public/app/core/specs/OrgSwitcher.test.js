import { __awaiter, __generator } from "tslib";
import React from 'react';
import { OrgSwitcher } from '../components/OrgSwitcher';
import { shallow } from 'enzyme';
import { OrgRole } from '@grafana/data';
var postMock = jest.fn().mockImplementation(jest.fn());
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () { return ({
        get: jest.fn().mockResolvedValue([]),
        post: postMock,
    }); },
}); });
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
var wrapper;
var orgSwitcher;
describe('OrgSwitcher', function () {
    describe('when switching org', function () {
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = shallow(React.createElement(OrgSwitcher, { onDismiss: function () { } }));
                        orgSwitcher = wrapper.instance();
                        orgSwitcher.setWindowLocation = jest.fn();
                        wrapper.update();
                        return [4 /*yield*/, orgSwitcher.setCurrentOrg({ name: 'mock org', orgId: 2, role: OrgRole.Viewer })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should switch orgId in call to backend', function () {
            expect(postMock).toBeCalledWith('/api/user/using/2');
        });
        it('should switch orgId in url and redirect to home page', function () {
            expect(orgSwitcher.setWindowLocation).toBeCalledWith('/subUrl/?orgId=2');
        });
    });
});
//# sourceMappingURL=OrgSwitcher.test.js.map