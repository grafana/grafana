import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { VariableOption } from '../types';
import { createTextBoxOptions } from './reducer';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/sharedReducer';
import { textboxBuilder } from '../shared/testing/builders';
import { locationService } from '@grafana/runtime';
import { toKeyedAction } from '../state/dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    locationService: {
      partial: jest.fn(),
      getSearchObject: () => ({}),
    },
  };
});
describe('textbox actions', () => {
  variableAdapters.setInit(() => [createTextBoxVariableAdapter()]);

  describe('when updateTextBoxVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const uid = 'uid';
      const variable = textboxBuilder()
        .withId('textbox')
        .withDashboardUid(uid)
        .withName('textbox')
        .withCurrent('A')
        .withQuery('A')
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction(uid, addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toDashboardVariableIdentifier(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(uid, createTextBoxOptions(toVariablePayload(variable))),
        toKeyedAction(uid, setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-textbox': 'A' });
    });
  });

  describe('when setTextBoxVariableOptionsFromUrl is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const urlValue = 'bB';
      const uid = 'uid';
      const variable = textboxBuilder()
        .withId('textbox')
        .withDashboardUid(uid)
        .withName('textbox')
        .withCurrent('A')
        .withQuery('A')
        .build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction(uid, addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenAsyncActionIsDispatched(
          setTextBoxVariableOptionsFromUrl(toDashboardVariableIdentifier(variable), urlValue),
          true
        );

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction(uid, changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: 'bB' }))),
        toKeyedAction(
          uid,
          setCurrentVariableValue(toVariablePayload(variable, { option: { text: 'bB', value: 'bB', selected: false } }))
        )
      );
    });
  });
});
