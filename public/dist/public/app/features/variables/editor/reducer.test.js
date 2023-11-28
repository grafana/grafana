import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { toVariablePayload } from '../utils';
import { addVariableEditorError, changeVariableEditorExtended, changeVariableNameFailed, changeVariableNameSucceeded, cleanEditorState, initialVariableEditorState, removeVariableEditorError, variableEditorMounted, variableEditorReducer, variableEditorUnMounted, } from './reducer';
describe('variableEditorReducer', () => {
    describe('when variableEditorMounted is dispatched', () => {
        it('then state should be correct', () => {
            const payload = { name: 'A name', id: '123' };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign({}, initialVariableEditorState))
                .whenActionIsDispatched(variableEditorMounted(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { name: 'A name', id: '123' }));
        });
    });
    describe('when variableEditorUnMounted is dispatched', () => {
        it('then state should be correct', () => {
            const initialState = Object.assign(Object.assign({}, initialVariableEditorState), { id: '0', name: 'A name', isValid: false, errors: { update: 'Something wrong' }, extended: null });
            const payload = toVariablePayload({ id: '0', type: 'textbox' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(variableEditorUnMounted(payload))
                .thenStateShouldEqual(Object.assign({}, initialVariableEditorState));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched there are other errors', () => {
        it('then state should be correct', () => {
            const initialState = Object.assign(Object.assign({}, initialVariableEditorState), { name: 'A duplicate name', isValid: false, errors: { name: 'Duplicate', update: 'Update failed' } });
            const payload = toVariablePayload({ id: '0', type: 'textbox' }, { newName: 'New Name' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { isValid: false, errors: { update: 'Update failed' }, name: 'New Name' }));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched there are no other errors', () => {
        it('then state should be correct', () => {
            const initialState = Object.assign(Object.assign({}, initialVariableEditorState), { name: 'A duplicate name', isValid: false, errors: { name: 'Duplicate' } });
            const payload = toVariablePayload({ id: '0', type: 'textbox' }, { newName: 'New Name' });
            reducerTester()
                .givenReducer(variableEditorReducer, initialState)
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { isValid: true, errors: {}, name: 'New Name' }));
        });
    });
    describe('when changeVariableNameFailed is dispatched', () => {
        it('then state should be correct', () => {
            const payload = { newName: 'Duplicate name', errorText: 'Name is an duplicate' };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign({}, initialVariableEditorState))
                .whenActionIsDispatched(changeVariableNameFailed(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { isValid: false, errors: { name: 'Name is an duplicate' }, name: 'Duplicate name' }));
        });
    });
    describe('when addVariableEditorError is dispatched', () => {
        it('then state should be correct', () => {
            const payload = { errorProp: 'someProp', errorText: 'someProp failed' };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign({}, initialVariableEditorState))
                .whenActionIsDispatched(addVariableEditorError(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { isValid: false, errors: { someProp: 'someProp failed' } }));
        });
    });
    describe('when removeVariableEditorError is dispatched and there are other errors', () => {
        it('then state should be correct', () => {
            const payload = { errorProp: 'someProp' };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign(Object.assign({}, initialVariableEditorState), { errors: { update: 'Update failed', someProp: 'someProp failed' }, isValid: false }))
                .whenActionIsDispatched(removeVariableEditorError(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { isValid: false, errors: { update: 'Update failed' } }));
        });
    });
    describe('when removeVariableEditorError is dispatched and there are no other errors', () => {
        it('then state should be correct', () => {
            const payload = { errorProp: 'someProp' };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign(Object.assign({}, initialVariableEditorState), { errors: { someProp: 'someProp failed' }, isValid: false }))
                .whenActionIsDispatched(removeVariableEditorError(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { isValid: true, errors: {} }));
        });
    });
    describe('when changeVariableEditorExtended is dispatched', () => {
        it('then state should be correct', () => {
            const payload = { dataSourceTypes: [] };
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign({}, initialVariableEditorState))
                .whenActionIsDispatched(changeVariableEditorExtended(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialVariableEditorState), { extended: {
                    dataSourceTypes: [],
                } }));
        });
    });
    describe('when cleanEditorState is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(variableEditorReducer, Object.assign(Object.assign({}, initialVariableEditorState), { isValid: false, errors: { name: 'Name is an duplicate' }, name: 'Duplicate name' }))
                .whenActionIsDispatched(cleanEditorState())
                .thenStateShouldEqual(Object.assign({}, initialVariableEditorState));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map