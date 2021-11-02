import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialVariableModelState } from '../types';
import { variableAdapters } from '../adapters';
import { createAction } from '@reduxjs/toolkit';
import { cleanVariables, variablesReducer } from './variablesReducer';
import { toVariablePayload } from './types';
var variableAdapter = {
    id: 'mock',
    name: 'Mock label',
    description: 'Mock description',
    dependsOn: jest.fn(),
    updateOptions: jest.fn(),
    initialState: {},
    reducer: jest.fn().mockReturnValue({}),
    getValueForUrl: jest.fn(),
    getSaveModel: jest.fn(),
    picker: null,
    editor: null,
    setValue: jest.fn(),
    setValueFromUrl: jest.fn(),
};
variableAdapters.setInit(function () { return [__assign({}, variableAdapter)]; });
describe('variablesReducer', function () {
    describe('when cleanUpDashboard is dispatched', function () {
        it('then all variables except global variables should be removed', function () {
            var initialState = {
                '0': __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'query', name: 'Name-0', label: 'Label-0' }),
                '1': __assign(__assign({}, initialVariableModelState), { id: '1', index: 1, type: 'query', name: 'Name-1', label: 'Label-1', global: true }),
                '2': __assign(__assign({}, initialVariableModelState), { id: '2', index: 2, type: 'query', name: 'Name-2', label: 'Label-2' }),
                '3': __assign(__assign({}, initialVariableModelState), { id: '3', index: 3, type: 'query', name: 'Name-3', label: 'Label-3', global: true }),
            };
            reducerTester()
                .givenReducer(variablesReducer, initialState)
                .whenActionIsDispatched(cleanVariables())
                .thenStateShouldEqual({
                '1': __assign(__assign({}, initialVariableModelState), { id: '1', index: 1, type: 'query', name: 'Name-1', label: 'Label-1', global: true }),
                '3': __assign(__assign({}, initialVariableModelState), { id: '3', index: 3, type: 'query', name: 'Name-3', label: 'Label-3', global: true }),
            });
        });
    });
    describe('when any action is dispatched with a type prop that is registered in variableAdapters', function () {
        it('then the reducer for that variableAdapter should be invoked', function () {
            var initialState = {
                '0': __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'query', name: 'Name-0', label: 'Label-0' }),
            };
            variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
            var mockAction = createAction('mockAction');
            reducerTester()
                .givenReducer(variablesReducer, initialState)
                .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'mock', id: '0' })))
                .thenStateShouldEqual(initialState);
            expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(1);
            expect(variableAdapters.get('mock').reducer).toHaveBeenCalledWith(initialState, mockAction(toVariablePayload({ type: 'mock', id: '0' })));
        });
    });
    describe('when any action is dispatched with a type prop that is not registered in variableAdapters', function () {
        it('then the reducer for that variableAdapter should be invoked', function () {
            var initialState = {
                '0': __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'query', name: 'Name-0', label: 'Label-0' }),
            };
            variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
            var mockAction = createAction('mockAction');
            reducerTester()
                .givenReducer(variablesReducer, initialState)
                .whenActionIsDispatched(mockAction(toVariablePayload({ type: 'adhoc', id: '0' })))
                .thenStateShouldEqual(initialState);
            expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(0);
        });
    });
    describe('when any action is dispatched missing type prop', function () {
        it('then the reducer for that variableAdapter should be invoked', function () {
            var initialState = {
                '0': __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'query', name: 'Name-0', label: 'Label-0' }),
            };
            variableAdapters.get('mock').reducer = jest.fn().mockReturnValue(initialState);
            var mockAction = createAction('mockAction');
            reducerTester()
                .givenReducer(variablesReducer, initialState)
                .whenActionIsDispatched(mockAction('mocked'))
                .thenStateShouldEqual(initialState);
            expect(variableAdapters.get('mock').reducer).toHaveBeenCalledTimes(0);
        });
    });
});
//# sourceMappingURL=reducers.test.js.map