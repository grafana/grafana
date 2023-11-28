import { cloneDeep } from 'lodash';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../utils';
import { createConstantVariableAdapter } from './adapter';
import { constantVariableReducer, createConstantOptionsFromQuery } from './reducer';
describe('constantVariableReducer', () => {
    const adapter = createConstantVariableAdapter();
    describe('when createConstantOptionsFromQuery is dispatched', () => {
        it('then state should be correct', () => {
            const query = 'ABC';
            const id = '0';
            const { initialState } = getVariableTestContext(adapter, { id, query });
            const payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(constantVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { options: [
                        {
                            text: query,
                            value: query,
                            selected: false,
                        },
                    ] }),
            });
        });
    });
    describe('when createConstantOptionsFromQuery is dispatched and query contains spaces', () => {
        it('then state should be correct', () => {
            const query = '  ABC  ';
            const id = '0';
            const { initialState } = getVariableTestContext(adapter, { id, query });
            const payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(constantVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { options: [
                        {
                            text: query.trim(),
                            value: query.trim(),
                            selected: false,
                        },
                    ] }),
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map