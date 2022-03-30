import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { VariablesState } from '../state/types';
import { createDateTimeOptions, dateTimeVariableReducer } from './reducer';
import { DateTimeVariableModel } from '../types';
import { createDateTimeVariableAdapter } from './adapter';
import { toVariablePayload } from '../utils';

describe('dateTimeVariableReducer', () => {
  const adapter = createDateTimeVariableAdapter();

  describe('when createDateTimeOptions is dispatched', () => {
    it('then state should be correct', () => {
      const query = '1645138799999';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query, returnValue: 'end' });
      const payload = toVariablePayload({ id: '0', type: 'datetime' });

      reducerTester<VariablesState>()
        .givenReducer(dateTimeVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDateTimeOptions(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            options: [
              {
                text: query,
                value: query,
                selected: false,
              },
            ],
            current: {
              text: query,
              value: query,
              selected: false,
            },
          } as DateTimeVariableModel,
        });
    });
    it('then state should be correct returnValue=start', () => {
      const query = '1645138799999';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query, returnValue: 'start' });
      const payload = toVariablePayload({ id: '0', type: 'datetime' });

      reducerTester<VariablesState>()
        .givenReducer(dateTimeVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDateTimeOptions(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            options: [
              {
                text: query,
                value: query,
                selected: false,
              },
            ],
            current: {
              text: query,
              value: query,
              selected: false,
            },
          } as DateTimeVariableModel,
        });
    });
  });
});
