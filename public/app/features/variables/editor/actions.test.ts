import { variableAdapters } from '../adapters';
import { initialConstantVariableModelState } from '../constant/reducer';
import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { initialKeyedVariablesState, toKeyedAction } from '../state/keyedVariablesReducer';
import * as selectors from '../state/selectors';
import * as inspectUtils from '../inspect/utils';
import { addVariable } from '../state/sharedReducer';
import { createConstantVariableAdapter } from '../constant/adapter';
import { getNextAvailableId, switchToListMode, switchToNewMode } from './actions';
import { setIdInEditor } from './reducer';
import { initialState } from '../../dashboard/state/reducers';

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
  variableAdapters.setInit(() => [createConstantVariableAdapter()]);

  it('should dispatch with the correct rootStateKey', () => {
    jest.spyOn(selectors, 'getVariablesByKey').mockReturnValue([]);
    jest.spyOn(selectors, 'getNewVariableIndex').mockReturnValue(0);
    const mockId = 'constant0';
    const mockGetState = jest.fn().mockReturnValue({ templating: initialKeyedVariablesState });
    const mockDispatch = jest.fn();
    const model = { ...initialConstantVariableModelState, name: mockId, id: mockId, rootStateKey: 'null' };

    switchToNewMode(null, 'constant')(mockDispatch, mockGetState, undefined);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[0][0]).toEqual(
      toKeyedAction('null', addVariable({ data: { global: false, index: 0, model }, type: 'constant', id: mockId }))
    );
    expect(mockDispatch.mock.calls[1][0]).toEqual(toKeyedAction('null', setIdInEditor({ id: mockId })));
  });
});

describe('switchToListMode', () => {
  variableAdapters.setInit(() => [createConstantVariableAdapter()]);

  it('should dispatch with the correct rootStateKey', () => {
    jest.spyOn(selectors, 'getEditorVariables').mockReturnValue([]);
    jest.spyOn(inspectUtils, 'createUsagesNetwork').mockReturnValue({ usages: [], unUsed: [] });
    jest.spyOn(inspectUtils, 'transformUsagesToNetwork').mockReturnValue([]);
    const mockGetState = jest.fn().mockReturnValue({ templating: initialKeyedVariablesState, dashboard: initialState });
    const mockDispatch = jest.fn();

    switchToListMode(null)(mockDispatch, mockGetState, undefined);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[0][0]).toEqual(toKeyedAction('null', expect.any(Object)));
    expect(mockDispatch.mock.calls[1][0]).toEqual(toKeyedAction('null', expect.any(Object)));
  });
});
