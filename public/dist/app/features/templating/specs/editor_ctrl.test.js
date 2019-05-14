import { VariableEditorCtrl } from '../editor_ctrl';
var mockEmit;
jest.mock('app/core/app_events', function () {
    mockEmit = jest.fn();
    return {
        emit: mockEmit,
    };
});
describe('VariableEditorCtrl', function () {
    var scope = {
        runQuery: function () {
            return Promise.resolve({});
        },
    };
    describe('When running a variable query and the data source returns an error', function () {
        beforeEach(function () {
            var variableSrv = {
                updateOptions: function () {
                    return Promise.reject({
                        data: { message: 'error' },
                    });
                },
            };
            return new VariableEditorCtrl(scope, {}, variableSrv, {});
        });
        it('should emit an error', function () {
            return scope.runQuery().then(function (res) {
                expect(mockEmit).toBeCalled();
                expect(mockEmit.mock.calls[0][0]).toBe('alert-error');
                expect(mockEmit.mock.calls[0][1][0]).toBe('Templating');
                expect(mockEmit.mock.calls[0][1][1]).toBe('Template variables could not be initialized: error');
            });
        });
    });
});
//# sourceMappingURL=editor_ctrl.test.js.map