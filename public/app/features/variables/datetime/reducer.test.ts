import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload, VariablesState } from '../state/types';
import { createDateTimeOptions, dateTimeVariableReducer } from './reducer';
import { DateTimeVariableModel } from '../types';
import { createDateTimeVariableAdapter } from './adapter';

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

  //   describe('when createTextBoxOptions is dispatched and query contains spaces', () => {
  //     it('then state should be correct', () => {
  //       const query = '  ABC  ';
  //       const id = '0';
  //       const { initialState } = getVariableTestContext(adapter, { id, query });
  //       const payload = toVariablePayload({ id: '0', type: 'textbox' });

  //       reducerTester<VariablesState>()
  //         .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
  //         .whenActionIsDispatched(createTextBoxOptions(payload))
  //         .thenStateShouldEqual({
  //           [id]: {
  //             ...initialState[id],
  //             options: [
  //               {
  //                 text: query.trim(),
  //                 value: query.trim(),
  //                 selected: false,
  //               },
  //             ],
  //             current: {
  //               text: query.trim(),
  //               value: query.trim(),
  //               selected: false,
  //             },
  //           } as TextBoxVariableModel,
  //         });
  //     });
  //   });
});
