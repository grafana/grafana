import { initialState } from '../../dashboard/state/reducers';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { initialConstantVariableModelState } from '../constant/reducer';
import * as inspectUtils from '../inspect/utils';
import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { initialKeyedVariablesState, toKeyedAction } from '../state/keyedVariablesReducer';
import * as selectors from '../state/selectors';
import { addVariable } from '../state/sharedReducer';

import { getNextAvailableId, initListMode, createNewVariable } from './actions';

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

describe('createNewVariable', () => {
  variableAdapters.setInit(() => [createConstantVariableAdapter()]);

  it('should dispatch with the correct rootStateKey', () => {
    jest.spyOn(selectors, 'getVariablesByKey').mockReturnValue([]);
    jest.spyOn(selectors, 'getNewVariableIndex').mockReturnValue(0);
    const mockId = 'constant0';
    const mockGetState = jest.fn().mockReturnValue({ templating: initialKeyedVariablesState });
    const mockDispatch = jest.fn();
    const model = { ...initialConstantVariableModelState, name: mockId, id: mockId, rootStateKey: 'null' };

    createNewVariable(null, 'constant')(mockDispatch, mockGetState, undefined);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toEqual(
      toKeyedAction('null', addVariable({ data: { global: false, index: 0, model }, type: 'constant', id: mockId }))
    );
  });
});

describe('initListMode', () => {
  variableAdapters.setInit(() => [createConstantVariableAdapter()]);

  it('should dispatch with the correct rootStateKey', () => {
    jest.spyOn(selectors, 'getEditorVariables').mockReturnValue([]);
    jest.spyOn(inspectUtils, 'createUsagesNetwork').mockReturnValue({ usages: [], unUsed: [] });
    jest.spyOn(inspectUtils, 'transformUsagesToNetwork').mockReturnValue([]);
    const mockGetState = jest.fn().mockReturnValue({ templating: initialKeyedVariablesState, dashboard: initialState });
    const mockDispatch = jest.fn();

    initListMode(null)(mockDispatch, mockGetState, undefined);
    const keyedAction = {
      type: expect.any(String),
      payload: {
        key: 'null',
        action: expect.any(Object),
      },
    };
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject(keyedAction);
  });
});
