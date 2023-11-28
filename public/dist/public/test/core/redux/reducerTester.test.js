import { createAction } from '@reduxjs/toolkit';
import { reducerTester } from './reducerTester';
const initialState = {
    data: [],
};
const dummyAction = createAction('dummyAction');
const mutatingReducer = (state = initialState, action) => {
    if (dummyAction.match(action)) {
        state.data.push(action.payload);
        return state;
    }
    return state;
};
const okReducer = (state = initialState, action) => {
    if (dummyAction.match(action)) {
        return Object.assign(Object.assign({}, state), { data: state.data.concat(action.payload) });
    }
    return state;
};
describe('reducerTester', () => {
    describe('when reducer mutates state', () => {
        it('then it should throw', () => {
            expect(() => {
                reducerTester()
                    .givenReducer(mutatingReducer, initialState)
                    .whenActionIsDispatched(dummyAction('some string'));
            }).toThrow();
        });
    });
    describe('when reducer does not mutate state', () => {
        it('then it should not throw', () => {
            expect(() => {
                reducerTester()
                    .givenReducer(okReducer, initialState)
                    .whenActionIsDispatched(dummyAction('some string'));
            }).not.toThrow();
        });
    });
});
//# sourceMappingURL=reducerTester.test.js.map