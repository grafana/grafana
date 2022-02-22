import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { getNextAvailableId, switchToNewMode } from './actions';
import * as selectors from '../state/selectors';
import { initialKeyedVariablesState, toKeyedAction } from '../state/keyedVariablesReducer';

describe('getNextAvailableId', () => {
  describe('when called with a custom type and there is already 2 variables', () => {
    it('then the correct id should be created', () => {
      const custom1 = customBuilder().withId('custom0').withName('custom0').build();
      const constant1 = constantBuilder().withId('custom1').withName('custom1').build();
      const variables = [custom1, constant1];
      const type = 'custom';

      const result = getNextAvailableId(type, variables);

      expect(result).toEqual('custom2');
    });
  });
});

describe('switchToNewMode', () => {
  it('should dispatch with the correct rootStateKey', () => {
    jest.spyOn(selectors, 'getVariablesByKey').mockReturnValue([]);
    jest.spyOn(selectors, 'getNewVariableIndex').mockReturnValue(0);
    const mockGetState = jest.fn().mockReturnValue({ templating: initialKeyedVariablesState });
    const mockDispatch = jest.fn();
    switchToNewMode(null)(mockDispatch, mockGetState, undefined);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[0]).toEqual(toKeyedAction('null', null));
    expect(mockDispatch.mock.calls[1]).toEqual(toKeyedAction('null', null));
  });
});
