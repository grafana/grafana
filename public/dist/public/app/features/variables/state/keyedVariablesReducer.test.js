import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TransactionStatus } from '../types';
import { initialKeyedVariablesState, keyedVariablesReducer, toKeyedAction, } from './keyedVariablesReducer';
import { getInitialTemplatingState } from './reducers';
import { initialTransactionState, variablesCompleteTransaction, variablesInitTransaction } from './transactionReducer';
describe('dashboardVariablesReducer', () => {
    describe('when an toUidAction is dispatched', () => {
        it('then state should be correct', () => {
            const key = 'key';
            reducerTester()
                .givenReducer(keyedVariablesReducer, Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: key, keys: {
                    [key]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: key }) }),
                } }))
                .whenActionIsDispatched(toKeyedAction(key, variablesCompleteTransaction({ uid: key })))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: key, keys: {
                    [key]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: key, status: TransactionStatus.Completed }) }),
                } }));
        });
    });
    describe('when an toUidAction with variablesInitTransaction is dispatched', () => {
        it('then lastUid property should be correct', () => {
            const lastUid = 'lastUid';
            const key = 'key';
            reducerTester()
                .givenReducer(keyedVariablesReducer, Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: lastUid, keys: {
                    [lastUid]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: lastUid, status: TransactionStatus.Completed }) }),
                } }))
                .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: key, keys: {
                    [key]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: key, status: TransactionStatus.Fetching }) }),
                    [lastUid]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: lastUid, status: TransactionStatus.Completed }) }),
                } }));
        });
    });
    describe('when action other than toUidAction is dispatched', () => {
        it('then state should not be affected', () => {
            const key = 'key';
            reducerTester()
                .givenReducer(keyedVariablesReducer, Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: key, keys: {
                    [key]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: key, status: TransactionStatus.Completed }) }),
                } }))
                .whenActionIsDispatched(variablesInitTransaction({ uid: 'newUid' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: key, keys: {
                    [key]: Object.assign(Object.assign({}, getInitialTemplatingState()), { transaction: Object.assign(Object.assign({}, initialTransactionState), { uid: key, status: TransactionStatus.Completed }) }),
                } }));
        });
    });
});
//# sourceMappingURL=keyedVariablesReducer.test.js.map