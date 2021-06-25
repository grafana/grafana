import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { VariableOption } from '../types';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions } from './reducer';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/sharedReducer';
import { textboxBuilder } from '../shared/testing/builders';
import { locationService } from '@grafana/runtime';

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

      const variable = textboxBuilder().withId('textbox').withName('textbox').withCurrent('A').withQuery('A').build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        createTextBoxOptions(toVariablePayload(variable)),
        setCurrentVariableValue(toVariablePayload(variable, { option }))
      );
      expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-textbox': 'A' });
    });
  });

  describe('when setTextBoxVariableOptionsFromUrl is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const urlValue = 'bB';
      const variable = textboxBuilder().withId('textbox').withName('textbox').withCurrent('A').withQuery('A').build();

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenAsyncActionIsDispatched(setTextBoxVariableOptionsFromUrl(toVariablePayload(variable), urlValue), true);

      tester.thenDispatchedActionsShouldEqual(
        changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: 'bB' })),
        setCurrentVariableValue(toVariablePayload(variable, { option: { text: 'bB', value: 'bB', selected: false } }))
      );
    });
  });
});
