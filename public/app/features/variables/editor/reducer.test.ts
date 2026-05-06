import { reducerTester } from '../../../../test/core/redux/reducerTester';

import {
  addVariableEditorError,
  changeVariableEditorExtended,
  cleanEditorState,
  initialVariableEditorState,
  removeVariableEditorError,
  variableEditorReducer,
  type VariableEditorState,
} from './reducer';

describe('variableEditorReducer', () => {
  describe('when addVariableEditorError is dispatched', () => {
    it('then state should be correct', () => {
      const payload = { errorProp: 'someProp', errorText: 'someProp failed' };
      reducerTester<VariableEditorState>()
        .givenReducer(variableEditorReducer, { ...initialVariableEditorState })
        .whenActionIsDispatched(addVariableEditorError(payload))
        .thenStateShouldEqual({
          ...initialVariableEditorState,
          isValid: false,
          errors: { someProp: 'someProp failed' },
        });
    });
  });

  describe('when removeVariableEditorError is dispatched and there are other errors', () => {
    it('then state should be correct', () => {
      const payload = { errorProp: 'someProp' };
      reducerTester<VariableEditorState>()
        .givenReducer(variableEditorReducer, {
          ...initialVariableEditorState,
          errors: { update: 'Update failed', someProp: 'someProp failed' },
          isValid: false,
        })
        .whenActionIsDispatched(removeVariableEditorError(payload))
        .thenStateShouldEqual({
          ...initialVariableEditorState,
          isValid: false,
          errors: { update: 'Update failed' },
        });
    });
  });

  describe('when removeVariableEditorError is dispatched and there are no other errors', () => {
    it('then state should be correct', () => {
      const payload = { errorProp: 'someProp' };
      reducerTester<VariableEditorState>()
        .givenReducer(variableEditorReducer, {
          ...initialVariableEditorState,
          errors: { someProp: 'someProp failed' },
          isValid: false,
        })
        .whenActionIsDispatched(removeVariableEditorError(payload))
        .thenStateShouldEqual({
          ...initialVariableEditorState,
          isValid: true,
          errors: {},
        });
    });
  });

  describe('when changeVariableEditorExtended is dispatched', () => {
    it('then state should be correct', () => {
      const payload = { dataSourceTypes: [] };

      reducerTester<VariableEditorState>()
        .givenReducer(variableEditorReducer, { ...initialVariableEditorState })
        .whenActionIsDispatched(changeVariableEditorExtended(payload))
        .thenStateShouldEqual({
          ...initialVariableEditorState,
          extended: {
            dataSourceTypes: [],
          },
        });
    });
  });

  describe('when cleanEditorState is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<VariableEditorState>()
        .givenReducer(variableEditorReducer, {
          ...initialVariableEditorState,
          isValid: false,
          errors: { name: 'Name is an duplicate' },
          name: 'Duplicate name',
        })
        .whenActionIsDispatched(cleanEditorState())
        .thenStateShouldEqual({ ...initialVariableEditorState });
    });
  });
});
