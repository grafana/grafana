import cloneDeep from 'lodash/cloneDeep';

import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createIntervalVariableAdapter } from './adapter';
import { IntervalVariableModel } from '../../templating/types';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { VariablesState } from '../state/variablesReducer';
import { createIntervalOptions, intervalVariableReducer } from './reducer';

describe('intervalVariableReducer', () => {
  const adapter = createIntervalVariableAdapter();
  describe('when createIntervalOptions is dispatched', () => {
    describe('and auto is false', () => {
      it('then state should be correct', () => {
        const id = '0';
        const query = '1s,1m,1h,1d';
        const auto = false;
        const { initialState } = getVariableTestContext<IntervalVariableModel>(adapter, { id, query, auto });
        const payload = toVariablePayload({ id: '0', type: 'interval' });

        reducerTester<VariablesState>()
          .givenReducer(intervalVariableReducer, cloneDeep(initialState))
          .whenActionIsDispatched(createIntervalOptions(payload))
          .thenStateShouldEqual({
            '0': {
              ...initialState['0'],
              id: '0',
              query: '1s,1m,1h,1d',
              auto: false,
              options: [
                { text: '1s', value: '1s', selected: false },
                { text: '1m', value: '1m', selected: false },
                { text: '1h', value: '1h', selected: false },
                { text: '1d', value: '1d', selected: false },
              ],
            } as IntervalVariableModel,
          });
      });
    });

    describe('and auto is true', () => {
      it('then state should be correct', () => {
        const id = '0';
        const query = '1s,1m,1h,1d';
        const auto = true;
        const { initialState } = getVariableTestContext<IntervalVariableModel>(adapter, { id, query, auto });
        const payload = toVariablePayload({ id: '0', type: 'interval' });

        reducerTester<VariablesState>()
          .givenReducer(intervalVariableReducer, cloneDeep(initialState))
          .whenActionIsDispatched(createIntervalOptions(payload))
          .thenStateShouldEqual({
            '0': {
              ...initialState['0'],
              id: '0',
              query: '1s,1m,1h,1d',
              auto: true,
              options: [
                { text: 'auto', value: '$__auto_interval_0', selected: false },
                { text: '1s', value: '1s', selected: false },
                { text: '1m', value: '1m', selected: false },
                { text: '1h', value: '1h', selected: false },
                { text: '1d', value: '1d', selected: false },
              ],
            } as IntervalVariableModel,
          });
      });
    });

    describe('and query contains "', () => {
      it('then state should be correct', () => {
        const id = '0';
        const query = '"kalle, anka","donald, duck"';
        const auto = false;
        const { initialState } = getVariableTestContext<IntervalVariableModel>(adapter, { id, query, auto });
        const payload = toVariablePayload({ id: '0', type: 'interval' });

        reducerTester<VariablesState>()
          .givenReducer(intervalVariableReducer, cloneDeep(initialState))
          .whenActionIsDispatched(createIntervalOptions(payload))
          .thenStateShouldEqual({
            '0': {
              ...initialState['0'],
              id: '0',
              query: '"kalle, anka","donald, duck"',
              auto: false,
              options: [
                { text: 'kalle, anka', value: 'kalle, anka', selected: false },
                { text: 'donald, duck', value: 'donald, duck', selected: false },
              ],
            } as IntervalVariableModel,
          });
      });
    });

    describe("and query contains '", () => {
      it('then state should be correct', () => {
        const id = '0';
        const query = "'kalle, anka','donald, duck'";
        const auto = false;
        const { initialState } = getVariableTestContext<IntervalVariableModel>(adapter, { id, query, auto });
        const payload = toVariablePayload({ id: '0', type: 'interval' });

        reducerTester<VariablesState>()
          .givenReducer(intervalVariableReducer, cloneDeep(initialState))
          .whenActionIsDispatched(createIntervalOptions(payload))
          .thenStateShouldEqual({
            '0': {
              ...initialState['0'],
              id: '0',
              query: "'kalle, anka','donald, duck'",
              auto: false,
              options: [
                { text: 'kalle, anka', value: 'kalle, anka', selected: false },
                { text: 'donald, duck', value: 'donald, duck', selected: false },
              ],
            } as IntervalVariableModel,
          });
      });
    });
  });
});
