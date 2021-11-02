import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { addVariableEditorError, changeVariableEditorExtended, changeVariableNameFailed, changeVariableNameSucceeded, cleanEditorState, clearIdInEditor, initialVariableEditorState, removeVariableEditorError, setIdInEditor, variableEditorMounted, variableEditorReducer, variableEditorUnMounted, } from './reducer';
import { toVariablePayload } from '../state/types';
describe('variableEditorReducer', function () {
    describe('when setIdInEditor is dispatched', function () {
        it('then state should be correct', function () {
            var payload = { id: '0' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign({}, initialVariableEditorState))
                .whenActionIsDispatched(setIdInEditor(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { id: '0' }));
        });
    });
    describe('when clearIdInEditor is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(variableEditorReducer, __assign(__assign({}, initialVariableEditorState), { id: '0' }))
                .whenActionIsDispatched(clearIdInEditor())
                .thenStateShouldEqual(__assign({}, initialVariableEditorState));
        });
    });
    describe('when variableEditorMounted is dispatched', function () {
        it('then state should be correct', function () {
            var payload = { name: 'A name' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign({}, initialVariableEditorState))
                .whenActionIsDispatched(variableEditorMounted(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { name: 'A name' }));
        });
    });
    describe('when variableEditorUnMounted is dispatched', function () {
        it('then state should be correct', function () {
            var initialState = __assign(__assign({}, initialVariableEditorState), { id: '0', name: 'A name', isValid: false, errors: { update: 'Something wrong' }, extended: { prop: 1000 } });
            var payload = toVariablePayload({ id: '0', type: 'textbox' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(variableEditorUnMounted(payload))
                .thenStateShouldEqual(__assign({}, initialVariableEditorState));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched there are other errors', function () {
        it('then state should be correct', function () {
            var initialState = __assign(__assign({}, initialVariableEditorState), { name: 'A duplicate name', isValid: false, errors: { name: 'Duplicate', update: 'Update failed' } });
            var payload = toVariablePayload({ id: '0', type: 'textbox' }, { newName: 'New Name' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { isValid: false, errors: { update: 'Update failed' }, name: 'New Name' }));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched there are no other errors', function () {
        it('then state should be correct', function () {
            var initialState = __assign(__assign({}, initialVariableEditorState), { name: 'A duplicate name', isValid: false, errors: { name: 'Duplicate' } });
            var payload = toVariablePayload({ id: '0', type: 'textbox' }, { newName: 'New Name' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { isValid: true, errors: {}, name: 'New Name' }));
        });
    });
    describe('when changeVariableNameFailed is dispatched', function () {
        it('then state should be correct', function () {
            var payload = { newName: 'Duplicate name', errorText: 'Name is an duplicate' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign({}, initialVariableEditorState))
                .whenActionIsDispatched(changeVariableNameFailed(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { isValid: false, errors: { name: 'Name is an duplicate' }, name: 'Duplicate name' }));
        });
    });
    describe('when addVariableEditorError is dispatched', function () {
        it('then state should be correct', function () {
            var payload = { errorProp: 'someProp', errorText: 'someProp failed' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign({}, initialVariableEditorState))
                .whenActionIsDispatched(addVariableEditorError(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { isValid: false, errors: { someProp: 'someProp failed' } }));
        });
    });
    describe('when removeVariableEditorError is dispatched and there are other errors', function () {
        it('then state should be correct', function () {
            var payload = { errorProp: 'someProp' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign(__assign({}, initialVariableEditorState), { errors: { update: 'Update failed', someProp: 'someProp failed' }, isValid: false }))
                .whenActionIsDispatched(removeVariableEditorError(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { isValid: false, errors: { update: 'Update failed' } }));
        });
    });
    describe('when removeVariableEditorError is dispatched and there are no other errors', function () {
        it('then state should be correct', function () {
            var payload = { errorProp: 'someProp' };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign(__assign({}, initialVariableEditorState), { errors: { someProp: 'someProp failed' }, isValid: false }))
                .whenActionIsDispatched(removeVariableEditorError(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { isValid: true, errors: {} }));
        });
    });
    describe('when changeVariableEditorExtended is dispatched', function () {
        it('then state should be correct', function () {
            var payload = { propName: 'someProp', propValue: [{}] };
            reducerTester()
                .givenReducer(variableEditorReducer, __assign({}, initialVariableEditorState))
                .whenActionIsDispatched(changeVariableEditorExtended(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialVariableEditorState), { extended: {
                    someProp: [{}],
                } }));
        });
    });
    describe('when cleanEditorState is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(variableEditorReducer, __assign(__assign({}, initialVariableEditorState), { isValid: false, errors: { name: 'Name is an duplicate' }, name: 'Duplicate name' }))
                .whenActionIsDispatched(cleanEditorState())
                .thenStateShouldEqual(__assign({}, initialVariableEditorState));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map