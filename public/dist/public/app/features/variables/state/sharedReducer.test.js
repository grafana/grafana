import { __assign } from "tslib";
import { cloneDeep } from 'lodash';
import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { addVariable, changeVariableOrder, changeVariableProp, changeVariableType, duplicateVariable, removeVariable, setCurrentVariableValue, sharedReducer, variableStateCompleted, variableStateFailed, variableStateFetching, variableStateNotStarted, } from './sharedReducer';
import { VariableHide } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, initialVariablesState, toVariablePayload, } from './types';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableModelState } from '../query/reducer';
import { getVariableState, getVariableTestContext } from './helpers';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { createConstantVariableAdapter } from '../constant/adapter';
import { initialConstantVariableModelState } from '../constant/reducer';
variableAdapters.setInit(function () { return [createQueryVariableAdapter(), createConstantVariableAdapter()]; });
describe('sharedReducer', function () {
    describe('when addVariable is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var model = {
                name: 'name from model',
                type: 'type from model',
                current: undefined,
            };
            var expected = __assign(__assign({}, initialQueryVariableModelState), { id: 'name from model', global: true, index: 0, name: 'name from model', type: 'type from model', current: {} });
            var payload = toVariablePayload({ id: 'name from model', type: 'query' }, { global: true, index: 0, model: model });
            reducerTester()
                .givenReducer(sharedReducer, __assign({}, initialVariablesState))
                .whenActionIsDispatched(addVariable(payload))
                .thenStateShouldEqual((_a = {},
                _a['name from model'] = expected,
                _a));
        });
    });
    describe('when addVariable is dispatched for a constant model', function () {
        it('then state should be correct', function () {
            var _a;
            var model = {
                name: 'constant',
                type: 'constant',
                query: 'a constant',
                current: { selected: true, text: 'A', value: 'A' },
                options: [{ selected: true, text: 'A', value: 'A' }],
            };
            var expected = __assign(__assign({}, initialConstantVariableModelState), { id: 'constant', global: true, index: 0, name: 'constant', type: 'constant', query: 'a constant', current: { selected: true, text: 'a constant', value: 'a constant' }, options: [{ selected: true, text: 'a constant', value: 'a constant' }] });
            var payload = toVariablePayload({ id: 'constant', type: 'constant' }, { global: true, index: 0, model: model });
            reducerTester()
                .givenReducer(sharedReducer, __assign({}, initialVariablesState))
                .whenActionIsDispatched(addVariable(payload))
                .thenStateShouldEqual((_a = {},
                _a['constant'] = expected,
                _a));
        });
    });
    describe('when removeVariable is dispatched and reIndex is true', function () {
        it('then state should be correct', function () {
            var initialState = getVariableState(3);
            var payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: true });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(removeVariable(payload))
                .thenStateShouldEqual({
                '0': {
                    id: '0',
                    type: 'query',
                    name: 'Name-0',
                    hide: VariableHide.dontHide,
                    index: 0,
                    label: 'Label-0',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '2': {
                    id: '2',
                    type: 'query',
                    name: 'Name-2',
                    hide: VariableHide.dontHide,
                    index: 1,
                    label: 'Label-2',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
            });
        });
    });
    describe('when removeVariable is dispatched and reIndex is false', function () {
        it('then state should be correct', function () {
            var initialState = getVariableState(3);
            var payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: false });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(removeVariable(payload))
                .thenStateShouldEqual({
                '0': {
                    id: '0',
                    type: 'query',
                    name: 'Name-0',
                    hide: VariableHide.dontHide,
                    index: 0,
                    label: 'Label-0',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '2': {
                    id: '2',
                    type: 'query',
                    name: 'Name-2',
                    hide: VariableHide.dontHide,
                    index: 2,
                    label: 'Label-2',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
            });
        });
    });
    describe('when duplicateVariable is dispatched', function () {
        it('then state should be correct', function () {
            var initialState = getVariableState(3);
            var payload = toVariablePayload({ id: '1', type: 'query' }, { newId: '11' });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(duplicateVariable(payload))
                .thenStateShouldEqual({
                '0': {
                    id: '0',
                    type: 'query',
                    name: 'Name-0',
                    hide: VariableHide.dontHide,
                    index: 0,
                    label: 'Label-0',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '1': {
                    id: '1',
                    type: 'query',
                    name: 'Name-1',
                    hide: VariableHide.dontHide,
                    index: 1,
                    label: 'Label-1',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '2': {
                    id: '2',
                    type: 'query',
                    name: 'Name-2',
                    hide: VariableHide.dontHide,
                    index: 2,
                    label: 'Label-2',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '11': __assign(__assign({}, initialQueryVariableModelState), { id: '11', name: 'copy_of_Name-1', index: 3, label: 'Label-1' }),
            });
        });
    });
    describe('when changeVariableOrder is dispatched', function () {
        it('then state should be correct', function () {
            var initialState = getVariableState(3);
            var payload = toVariablePayload({ id: '1', type: 'query' }, { fromIndex: 1, toIndex: 0 });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(changeVariableOrder(payload))
                .thenStateShouldEqual({
                '0': {
                    id: '0',
                    type: 'query',
                    name: 'Name-0',
                    hide: VariableHide.dontHide,
                    index: 1,
                    label: 'Label-0',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '1': {
                    id: '1',
                    type: 'query',
                    name: 'Name-1',
                    hide: VariableHide.dontHide,
                    index: 0,
                    label: 'Label-1',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
                '2': {
                    id: '2',
                    type: 'query',
                    name: 'Name-2',
                    hide: VariableHide.dontHide,
                    index: 2,
                    label: 'Label-2',
                    skipUrlSync: false,
                    global: false,
                    state: LoadingState.NotStarted,
                    error: null,
                    description: null,
                },
            });
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.text is an Array with values', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            var current = { text: ['A', 'B'], selected: true, value: ['A', 'B'] };
            var payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { selected: false, text: 'All', value: '$__all' },
                        { selected: true, text: 'A', value: 'A' },
                        { selected: true, text: 'B', value: 'B' },
                    ], current: { selected: true, text: ['A', 'B'], value: ['A', 'B'] } }) }));
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.value is an Array with values except All value', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            var current = { text: 'A + B', selected: true, value: ['A', 'B'] };
            var payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { selected: false, text: 'All', value: '$__all' },
                        { selected: true, text: 'A', value: 'A' },
                        { selected: true, text: 'B', value: 'B' },
                    ], current: { selected: true, text: 'A + B', value: ['A', 'B'] } }) }));
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.value is an Array with values containing All value', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            var current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
            var payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { selected: true, text: 'All', value: '$__all' },
                        { selected: false, text: 'A', value: 'A' },
                        { selected: false, text: 'B', value: 'B' },
                    ], current: { selected: true, text: 'All', value: ['$__all'] } }) }));
        });
    });
    describe('when variableStateNotStarted is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                state: LoadingState.Done,
                error: 'Some error',
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateNotStarted(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { state: LoadingState.NotStarted, error: null }) }));
        });
    });
    describe('when variableStateFetching is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                state: LoadingState.Done,
                error: 'Some error',
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateFetching(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { state: LoadingState.Loading, error: null }) }));
        });
    });
    describe('when variableStateCompleted is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, {
                state: LoadingState.Loading,
                error: 'Some error',
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateCompleted(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { state: LoadingState.Done, error: null }) }));
        });
    });
    describe('when variableStateFailed is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter, { state: LoadingState.Loading }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'query' }, { error: 'Some error' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateFailed(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { state: LoadingState.Error, error: 'Some error' }) }));
        });
    });
    describe('when changeVariableProp is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter).initialState;
            var propName = 'label';
            var propValue = 'Updated label';
            var payload = toVariablePayload({ id: '0', type: 'query' }, { propName: propName, propValue: propValue });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(changeVariableProp(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { label: 'Updated label' }) }));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched', function () {
        it('then state should be correct', function () {
            var adapter = createQueryVariableAdapter();
            var initialState = getVariableTestContext(adapter).initialState;
            var newName = 'A new name';
            var payload = toVariablePayload({ id: '0', type: 'query' }, { newName: newName });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { name: 'A new name' }) }));
        });
    });
    describe('when changeVariableType is dispatched', function () {
        it('then state should be correct', function () {
            var queryAdapter = createQueryVariableAdapter();
            var queryAdapterState = getVariableTestContext(queryAdapter).initialState;
            var constantAdapter = createConstantVariableAdapter();
            var constantAdapterState = getVariableTestContext(constantAdapter).initialState;
            var newType = 'constant';
            var identifier = { id: '0', type: 'query' };
            var payload = toVariablePayload(identifier, { newType: newType });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(queryAdapterState))
                .whenActionIsDispatched(changeVariableNameSucceeded(toVariablePayload(identifier, { newName: 'test' })))
                .whenActionIsDispatched(changeVariableProp(toVariablePayload(identifier, { propName: 'description', propValue: 'new description' })))
                .whenActionIsDispatched(changeVariableProp(toVariablePayload(identifier, { propName: 'label', propValue: 'new label' })))
                .whenActionIsDispatched(changeVariableType(payload))
                .thenStateShouldEqual(__assign(__assign({}, constantAdapterState), { '0': __assign(__assign({}, constantAdapterState[0]), { name: 'test', description: 'new description', label: 'new label', type: 'constant' }) }));
        });
    });
});
//# sourceMappingURL=sharedReducer.test.js.map