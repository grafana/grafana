import { actionCreatorFactory, resetAllActionCreatorTypes, noPayloadActionCreatorFactory, } from './actionCreatorFactory';
var setup = function (payload) {
    resetAllActionCreatorTypes();
    var actionCreator = actionCreatorFactory('dummy').create();
    var noPayloadactionCreator = noPayloadActionCreatorFactory('NoPayload').create();
    var result = actionCreator(payload);
    var noPayloadResult = noPayloadactionCreator();
    return { actionCreator: actionCreator, noPayloadactionCreator: noPayloadactionCreator, result: result, noPayloadResult: noPayloadResult };
};
describe('actionCreatorFactory', function () {
    describe('when calling create', function () {
        it('then it should create correct type string', function () {
            var payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
            var _a = setup(payload), actionCreator = _a.actionCreator, result = _a.result;
            expect(actionCreator.type).toEqual('dummy');
            expect(result.type).toEqual('dummy');
        });
        it('then it should create correct payload', function () {
            var payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
            var result = setup(payload).result;
            expect(result.payload).toEqual(payload);
        });
    });
    describe('when calling create with existing type', function () {
        it('then it should throw error', function () {
            var payload = { n: 1, b: true, s: 'dummy', o: { n: 1, b: true, s: 'dummy' } };
            setup(payload);
            expect(function () {
                noPayloadActionCreatorFactory('DuMmY').create();
            }).toThrow();
        });
    });
});
describe('noPayloadActionCreatorFactory', function () {
    describe('when calling create', function () {
        it('then it should create correct type string', function () {
            var _a = setup(), noPayloadResult = _a.noPayloadResult, noPayloadactionCreator = _a.noPayloadactionCreator;
            expect(noPayloadactionCreator.type).toEqual('NoPayload');
            expect(noPayloadResult.type).toEqual('NoPayload');
        });
        it('then it should create correct payload', function () {
            var noPayloadResult = setup().noPayloadResult;
            expect(noPayloadResult.payload).toBeUndefined();
        });
    });
    describe('when calling create with existing type', function () {
        it('then it should throw error', function () {
            setup();
            expect(function () {
                actionCreatorFactory('nOpAyLoAd').create();
            }).toThrow();
        });
    });
});
//# sourceMappingURL=actionCreatorFactory.test.js.map