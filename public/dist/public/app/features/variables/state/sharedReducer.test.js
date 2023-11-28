import { cloneDeep } from 'lodash';
import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { initialConstantVariableModelState } from '../constant/reducer';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { createQueryVariableAdapter } from '../query/adapter';
import { initialQueryVariableModelState } from '../query/reducer';
import { toVariablePayload } from '../utils';
import { createConstantVariable } from './__tests__/fixtures';
import { getVariableState, getVariableTestContext } from './helpers';
import { addVariable, changeVariableOrder, changeVariableProp, changeVariableType, duplicateVariable, removeVariable, setCurrentVariableValue, sharedReducer, variableStateCompleted, variableStateFailed, variableStateFetching, variableStateNotStarted, } from './sharedReducer';
import { initialVariablesState } from './types';
variableAdapters.setInit(() => [createQueryVariableAdapter(), createConstantVariableAdapter()]);
describe('sharedReducer', () => {
    describe('when addVariable is dispatched', () => {
        it('then state should be correct', () => {
            const model = {
                name: 'name from model',
                type: 'query',
                current: undefined,
            };
            const expected = Object.assign(Object.assign({}, initialQueryVariableModelState), { id: 'name from model', global: true, index: 0, name: 'name from model', type: 'query', current: {} });
            const payload = toVariablePayload({ id: 'name from model', type: 'query' }, { global: true, index: 0, model });
            reducerTester()
                .givenReducer(sharedReducer, Object.assign({}, initialVariablesState))
                .whenActionIsDispatched(addVariable(payload))
                .thenStateShouldEqual({
                ['name from model']: expected,
            });
        });
    });
    describe('when addVariable is dispatched for a constant model', () => {
        it('then state should be correct', () => {
            const model = {
                name: 'constant',
                type: 'constant',
                query: 'a constant',
                current: { selected: true, text: 'A', value: 'A' },
                options: [{ selected: true, text: 'A', value: 'A' }],
            };
            const expected = Object.assign(Object.assign({}, initialConstantVariableModelState), { id: 'constant', global: true, index: 0, name: 'constant', type: 'constant', query: 'a constant', current: { selected: true, text: 'a constant', value: 'a constant' }, options: [{ selected: true, text: 'a constant', value: 'a constant' }] });
            const payload = toVariablePayload({ id: 'constant', type: 'constant' }, { global: true, index: 0, model });
            reducerTester()
                .givenReducer(sharedReducer, Object.assign({}, initialVariablesState))
                .whenActionIsDispatched(addVariable(payload))
                .thenStateShouldEqual({
                ['constant']: expected,
            });
        });
    });
    describe('when removeVariable is dispatched and reIndex is true', () => {
        it('then state should be correct', () => {
            const initialState = getVariableState(3);
            const payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: true });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(removeVariable(payload))
                .thenStateShouldEqual({
                '0': Object.assign(Object.assign({}, initialState['0']), { index: 0 }),
                '2': Object.assign(Object.assign({}, initialState['2']), { index: 1 }),
            });
        });
    });
    describe('when removeVariable is dispatched and reIndex is false', () => {
        it('then state should be correct', () => {
            const initialState = getVariableState(3);
            const payload = toVariablePayload({ id: '1', type: 'query' }, { reIndex: false });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(removeVariable(payload))
                .thenStateShouldEqual({
                '0': initialState['0'],
                '2': initialState['2'],
            });
        });
    });
    describe('when duplicateVariable is dispatched', () => {
        it('then state should be correct', () => {
            const initialState = getVariableState(3, -1, false, true);
            const payload = toVariablePayload({ id: '1', type: 'query' }, { newId: '11' });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(duplicateVariable(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '11': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['1']), { id: '11', name: 'copy_of_Name-1', index: 3 }) }));
        });
        it('then state should be correct', () => {
            const initialState = getVariableState(3, -1, false, true);
            initialState['1'].name = 'copy_of_Name-1_2';
            const payload = toVariablePayload({ id: '1', type: 'query' }, { newId: '11' });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(duplicateVariable(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '11': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['1']), { id: '11', name: 'copy_of_copy_of_Name-1_2', index: 3 }) }));
        });
        it('then state should be correct', () => {
            const initialState = getVariableState(3, -1, false, true);
            initialState['0'].name = 'Name-0';
            initialState['1'].name = 'copy_of_Name-0_2';
            const payload = toVariablePayload({ id: '0', type: 'query' }, { newId: '01' });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(duplicateVariable(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '01': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['0']), { id: '01', name: 'copy_of_Name-0_3', index: 3 }) }));
        });
        it('then state should be correct', () => {
            const initialState = getVariableState(3, -1, false, true);
            initialState['1'].name = 'copy_of_Name-1_2';
            const duplicateOne = toVariablePayload({ id: '1', type: 'query' }, { newId: '11' });
            const duplicateTwo = toVariablePayload({ id: '1', type: 'query' }, { newId: '12' });
            const duplicateThree = toVariablePayload({ id: '1', type: 'query' }, { newId: '13' });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(duplicateVariable(duplicateOne))
                .whenActionIsDispatched(duplicateVariable(duplicateTwo))
                .whenActionIsDispatched(duplicateVariable(duplicateThree))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '11': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['1']), { id: '11', name: 'copy_of_copy_of_Name-1_2', index: 3 }), '12': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['1']), { id: '12', name: 'copy_of_copy_of_Name-1_2_1', index: 4 }), '13': Object.assign(Object.assign(Object.assign({}, initialQueryVariableModelState), initialState['1']), { id: '13', name: 'copy_of_copy_of_Name-1_2_2', index: 5 }) }));
        });
    });
    describe('when changeVariableOrder is dispatched', () => {
        it('then state should be correct', () => {
            const initialState = getVariableState(3);
            const payload = toVariablePayload({ id: '2', type: 'query' }, { fromIndex: 2, toIndex: 0 });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(changeVariableOrder(payload))
                .thenStateShouldEqual({
                '0': Object.assign(Object.assign({}, initialState['0']), { index: 1 }),
                '1': Object.assign(Object.assign({}, initialState['1']), { index: 2 }),
                '2': Object.assign(Object.assign({}, initialState['2']), { index: 0 }),
            });
        });
        it('then state should be correct', () => {
            const initialState = getVariableState(3);
            const payload = toVariablePayload({ id: '0', type: 'query' }, { fromIndex: 0, toIndex: 2 });
            reducerTester()
                .givenReducer(sharedReducer, initialState)
                .whenActionIsDispatched(changeVariableOrder(payload))
                .thenStateShouldEqual({
                '0': Object.assign(Object.assign({}, initialState['0']), { index: 2 }),
                '1': Object.assign(Object.assign({}, initialState['1']), { index: 0 }),
                '2': Object.assign(Object.assign({}, initialState['2']), { index: 1 }),
            });
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.text is an Array with values', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            });
            const current = { text: ['A', 'B'], selected: true, value: ['A', 'B'] };
            const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { options: [
                        { selected: false, text: 'All', value: '$__all' },
                        { selected: true, text: 'A', value: 'A' },
                        { selected: true, text: 'B', value: 'B' },
                    ], current: { selected: true, text: ['A', 'B'], value: ['A', 'B'] } }) }));
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.value is an Array with values except All value', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            });
            const current = { text: 'A + B', selected: true, value: ['A', 'B'] };
            const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { options: [
                        { selected: false, text: 'All', value: '$__all' },
                        { selected: true, text: 'A', value: 'A' },
                        { selected: true, text: 'B', value: 'B' },
                    ], current: { selected: true, text: 'A + B', value: ['A', 'B'] } }) }));
        });
    });
    describe('when setCurrentVariableValue is dispatched and current.value is an Array with values containing All value', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            });
            const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
            const payload = toVariablePayload({ id: '0', type: 'query' }, { option: current });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(setCurrentVariableValue(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { options: [
                        { selected: true, text: 'All', value: '$__all' },
                        { selected: false, text: 'A', value: 'A' },
                        { selected: false, text: 'B', value: 'B' },
                    ], current: { selected: true, text: 'All', value: ['$__all'] } }) }));
        });
    });
    describe('when variableStateNotStarted is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                state: LoadingState.Done,
                error: 'Some error',
            });
            const payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateNotStarted(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { state: LoadingState.NotStarted, error: null }) }));
        });
    });
    describe('when variableStateFetching is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                state: LoadingState.Done,
                error: 'Some error',
            });
            const payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateFetching(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { state: LoadingState.Loading, error: null }) }));
        });
    });
    describe('when variableStateCompleted is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, {
                state: LoadingState.Loading,
                error: 'Some error',
            });
            const payload = toVariablePayload({ id: '0', type: 'query' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateCompleted(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { state: LoadingState.Done, error: null }) }));
        });
    });
    describe('when variableStateFailed is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter, { state: LoadingState.Loading });
            const payload = toVariablePayload({ id: '0', type: 'query' }, { error: 'Some error' });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(variableStateFailed(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { state: LoadingState.Error, error: 'Some error' }) }));
        });
    });
    describe('when changeVariableProp is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter);
            const propName = 'label';
            const propValue = 'Updated label';
            const payload = toVariablePayload({ id: '0', type: 'query' }, { propName, propValue });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(changeVariableProp(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { label: 'Updated label' }) }));
        });
    });
    describe('when changeVariableNameSucceeded is dispatched', () => {
        it('then state should be correct', () => {
            const adapter = createQueryVariableAdapter();
            const { initialState } = getVariableTestContext(adapter);
            const newName = 'A new name';
            const payload = toVariablePayload({ id: '0', type: 'query' }, { newName });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(initialState))
                .whenActionIsDispatched(changeVariableNameSucceeded(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { '0': Object.assign(Object.assign({}, initialState[0]), { name: 'A new name' }) }));
        });
    });
    describe('when changeVariableType is dispatched', () => {
        it('then state should be correct', () => {
            const queryAdapter = createQueryVariableAdapter();
            const { initialState: queryAdapterState } = getVariableTestContext(queryAdapter);
            const constantAdapter = createConstantVariableAdapter();
            const { initialState: constantAdapterState } = getVariableTestContext(constantAdapter);
            const newType = 'constant';
            const identifier = { id: '0', type: 'query', rootStateKey: 'key' };
            const payload = toVariablePayload(identifier, { newType });
            reducerTester()
                .givenReducer(sharedReducer, cloneDeep(queryAdapterState))
                .whenActionIsDispatched(changeVariableNameSucceeded(toVariablePayload(identifier, { newName: 'test' })))
                .whenActionIsDispatched(changeVariableProp(toVariablePayload(identifier, { propName: 'description', propValue: 'new description' })))
                .whenActionIsDispatched(changeVariableProp(toVariablePayload(identifier, { propName: 'label', propValue: 'new label' })))
                .whenActionIsDispatched(changeVariableType(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, constantAdapterState), { '0': Object.assign(Object.assign({}, constantAdapterState[0]), createConstantVariable({
                    type: 'constant',
                    rootStateKey: 'key',
                    name: 'test',
                    description: 'new description',
                    label: 'new label',
                    current: {},
                })) }));
        });
    });
});
//# sourceMappingURL=sharedReducer.test.js.map