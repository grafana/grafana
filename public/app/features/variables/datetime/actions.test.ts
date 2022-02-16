import { variableAdapters } from '../adapters';
import { setDateTimeVariableOptionsFromUrl, updateDateTimeVariableOptions } from './actions';
import { createDateTimeVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { DateTimeVariableModel, initialVariableModelState, VariableOption } from '../types';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/sharedReducer';
import { createDateTimeOptions } from './reducer';

describe('datetime  actions', () => {
  variableAdapters.setInit(() => [createDateTimeVariableAdapter()]);

  describe('when updateDateTimeVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: '1645138799999',
        text: '1645138799999',
        selected: false,
      };

      const variable: DateTimeVariableModel = {
        ...initialVariableModelState,
        id: 'query0',
        index: 0,
        type: 'datetime',
        name: 'query0',
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [
          {
            selected: false,
            text: '1644966000000',
            value: '1644966000000',
          },
        ],
        query: '1645138799999',
        returnValue: 'end',
      };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          addVariable(toVariablePayload(variable, { global: false, index: variable.index, model: variable }))
        )
        .whenAsyncActionIsDispatched(updateDateTimeVariableOptions(toVariableIdentifier(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        createDateTimeOptions(toVariablePayload(variable)),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
      );
    });
    it('then correct actions are dispatched when returnValue = start', async () => {
      const option = {
        value: '1644966000000',
        text: '1644966000000',
        selected: false,
      };
      const variable: DateTimeVariableModel = {
        ...initialVariableModelState,
        id: 'query0',
        index: 0,
        type: 'datetime',
        name: 'query0',
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [
          {
            value: '1644966000000',
            text: '1644966000000',
            selected: false,
          },
        ],
        query: '1644966000000',
        returnValue: 'start',
      };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          addVariable(toVariablePayload(variable, { global: false, index: variable.index, model: variable }))
        )
        .whenAsyncActionIsDispatched(updateDateTimeVariableOptions(toVariableIdentifier(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        createDateTimeOptions(toVariablePayload(variable)),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
      );
    });
  });
  describe('when setDateTimeVariableOptionsFromUrl is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const urlValue = '1645138799998';
      const variable: DateTimeVariableModel = {
        ...initialVariableModelState,
        id: 'query0',
        index: 0,
        type: 'datetime',
        name: 'query0',
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [],
        query: '1645138799999',
        returnValue: 'end',
      };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          addVariable(toVariablePayload(variable, { global: false, index: variable.index, model: variable }))
        )
        .whenAsyncActionIsDispatched(setDateTimeVariableOptionsFromUrl(toVariableIdentifier(variable), urlValue), true);

      tester.thenDispatchedActionsShouldEqual(
        changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: urlValue })),
        setCurrentVariableValue(
          toVariablePayload(variable, { option: { text: urlValue, value: urlValue, selected: false } })
        )
      );
    });
    it('then correct actions are dispatched returnValue = start', async () => {
      const urlValue = '1644966000000';
      const variable: DateTimeVariableModel = {
        ...initialVariableModelState,
        id: 'query0',
        index: 0,
        type: 'datetime',
        name: 'query0',
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [],
        query: '1644966000000',
        returnValue: 'start',
      };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          addVariable(toVariablePayload(variable, { global: false, index: variable.index, model: variable }))
        )
        .whenAsyncActionIsDispatched(setDateTimeVariableOptionsFromUrl(toVariableIdentifier(variable), urlValue), true);

      tester.thenDispatchedActionsShouldEqual(
        changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: urlValue })),
        setCurrentVariableValue(
          toVariablePayload(variable, { option: { text: urlValue, value: urlValue, selected: false } })
        )
      );
    });
  });
});
