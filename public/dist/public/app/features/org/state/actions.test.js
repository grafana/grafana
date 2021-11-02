import { __awaiter, __generator } from "tslib";
import { updateOrganization } from './actions';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { thunkTester } from 'test/core/thunk/thunkTester';
var setup = function () {
    var initialState = {
        organization: {
            organization: {
                id: 1,
                name: 'New Org Name',
            },
        },
    };
    return {
        initialState: initialState,
    };
};
describe('updateOrganization', function () {
    describe('when updateOrganization thunk is dispatched', function () {
        var getMock = jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' });
        var putMock = jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' });
        var backendSrvMock = {
            get: getMock,
            put: putMock,
        };
        it('then it should dispatch updateConfigurationSubtitle', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialState, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        initialState = setup().initialState;
                        return [4 /*yield*/, thunkTester(initialState)
                                .givenThunk(updateOrganization)
                                .whenThunkIsDispatched({ getBackendSrv: function () { return backendSrvMock; } })];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions[0].type).toEqual(updateConfigurationSubtitle.type);
                        expect(dispatchedActions[0].payload).toEqual(initialState.organization.organization.name);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map