import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  initialQueryVariableEditorState,
  initialQueryVariableModelState,
  initialQueryVariablePickerState,
  queryVariableReducer,
} from './reducer';
import {
  addVariable,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  toVariablePayload,
  updateVariableOptions,
  updateVariableTags,
} from '../state/actions';
import { QueryVariableModel, VariableModel, VariableOption } from '../variable';
import cloneDeep from 'lodash/cloneDeep';
import { Deferred } from '../deferred';
import { MouseEvent } from 'react';
import { selectVariableOption } from './actions';

describe('queryVariableReducer', () => {
  describe('when addVariable is dispatched', () => {
    it('then state should be correct', () => {
      const model = ({ name: 'name from model', type: 'type from model' } as unknown) as QueryVariableModel;
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, { global: true, index: 0, model });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, { ...initialTemplatingState })
        .whenActionIsDispatched(addVariable(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState.variables[0].variable;
          const expectedState = { ...initialQueryVariableModelState };
          delete expectedState.initLock;
          expect(resultingRest).toEqual({
            ...expectedState,
            uuid: '0',
            index: 0,
            global: true,
            name: 'name from model',
            type: 'type from model',
          });
          expect(resultingState.variables[0].editor).toEqual(initialQueryVariableEditorState);
          expect(resultingState.variables[0].picker).toEqual(initialQueryVariablePickerState);
          // make sure that initLock is defined
          expect(resultingState.variables[0].variable?.initLock).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.promise).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.resolve).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.reject).toBeDefined();
          return true;
        });
    });
  });

  const getVariableTestContext = (variableOverrides: Partial<QueryVariableModel> = {}) => {
    const defaultVariable = {
      ...initialQueryVariableModelState,
      uuid: '0',
      index: 0,
      name: '0',
    };
    const variable = { ...defaultVariable, ...variableOverrides };
    const initialState: TemplatingState = {
      variables: {
        '0': {
          variable,
          editor: { ...initialQueryVariableEditorState },
          picker: { ...initialQueryVariablePickerState },
        },
      },
      uuidInEditor: null,
    };

    return { initialState };
  };

  describe('when updateVariableOptions is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: false },
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'A', value: 'A', selected: false },
                  { text: 'B', value: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'All', value: '$__all', selected: false }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'None', value: '', selected: false, isNone: true }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { text: 'All', value: '$__all', selected: false },
                  { text: 'A', value: 'A', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [{ text: 'A', value: 'A', selected: false }],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when updateVariableTags is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const tags: any[] = [{ text: 'A' }, { text: 'B' }];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, tags);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableTags(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                tags: [
                  { text: 'A', selected: false },
                  { text: 'B', selected: false },
                ],
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.text is an Array with values', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ['A', 'B'], selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'A + B', value: ['A', 'B'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'A + B',
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                selectedValues: [
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values except All value', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: 'A + B', selected: true, value: ['A', 'B'] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'A + B', value: ['A', 'B'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'A + B',
                options: [
                  { selected: false, text: 'All', value: '$__all' },
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
                selectedValues: [
                  { selected: true, text: 'A', value: 'A' },
                  { selected: true, text: 'B', value: 'B' },
                ],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when setCurrentVariableValue is dispatched and current.value is an Array with values containing All value', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, current);
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(setCurrentVariableValue(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                current: { selected: true, text: 'All', value: ['$__all'] },
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: 'All',
                options: [
                  { selected: true, text: 'All', value: '$__all' },
                  { selected: false, text: 'A', value: 'A' },
                  { selected: false, text: 'B', value: 'B' },
                ],
                selectedValues: [{ selected: true, text: 'All', value: '$__all' }],
              },
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when resolveInitLock is dispatched', () => {
    it('then state should be correct', () => {
      const initLock = ({
        resolve: jest.fn(),
        reject: jest.fn(),
        promise: jest.fn(),
      } as unknown) as Deferred;
      const { initialState } = getVariableTestContext({ initLock });
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(resolveInitLock(payload))
        .thenStatePredicateShouldEqual(resultingState => {
          // we need to remove initLock because instances will no be reference equal
          const { initLock, ...resultingRest } = resultingState.variables[0].variable;
          const expectedState = cloneDeep(initialState);
          delete expectedState.variables[0].variable.initLock;
          expect(resultingRest).toEqual(expectedState.variables[0].variable);
          expect(resultingState.uuidInEditor).toEqual(expectedState.uuidInEditor);
          expect(resultingState.variables[0].picker).toEqual(expectedState.variables[0].picker);
          expect(resultingState.variables[0].editor).toEqual(expectedState.variables[0].editor);
          // make sure that initLock is defined
          expect(resultingState.variables[0].variable?.initLock).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.promise).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.resolve).toBeDefined();
          expect(resultingState.variables[0].variable?.initLock.resolve).toHaveBeenCalledTimes(1);
          expect(resultingState.variables[0].variable?.initLock.reject).toBeDefined();
          return true;
        });
    });
  });

  describe('when removeInitLock is dispatched', () => {
    it('then state should be correct', () => {
      const initLock = ({
        resolve: jest.fn(),
        reject: jest.fn(),
        promise: jest.fn(),
      } as unknown) as Deferred;
      const { initialState } = getVariableTestContext({ initLock });
      const payload = toVariablePayload({ uuid: '0', type: 'query' });
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(removeInitLock(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                initLock: null,
              } as unknown) as VariableModel,
            },
          },
          uuidInEditor: null,
        });
    });
  });

  describe('when selectVariableOption is dispatched', () => {
    const opsAll = [
      { text: 'All', value: '$__all', selected: true },
      { text: 'A', value: 'A', selected: false },
      { text: 'B', value: 'B', selected: false },
    ];
    const opsA = [
      { text: 'All', value: '$__all', selected: false },
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: false },
    ];
    const opsB = [
      { text: 'All', value: '$__all', selected: false },
      { text: 'A', value: 'A', selected: false },
      { text: 'B', value: 'B', selected: true },
    ];
    const opsAB = [
      { text: 'All', value: '$__all', selected: false },
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: true },
    ];

    const opA = { text: 'A', selected: true, value: 'A' };
    const opANot = { text: 'A', selected: false, value: 'A' };
    const nullEv = (null as unknown) as MouseEvent<HTMLAnchorElement>;
    const event = ({ ctrlKey: true } as unknown) as MouseEvent<HTMLAnchorElement>;
    const opASel = [{ text: 'A', value: 'A', selected: true }];
    const opBSel = [{ text: 'B', value: 'B', selected: true }];
    const opAllSel = [{ text: 'All', value: '$__all', selected: true }];
    const opABSel = [
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: true },
    ];

    const expectSelectVariableOptionState = (args: {
      options: any;
      multi: any;
      forceSelect: any;
      event: any;
      option: any;
      expOps: any;
      expCurr: any;
      expSel: any;
    }) => {
      const { initialState } = getVariableTestContext({ options: args.options, multi: args.multi });
      const payload = toVariablePayload(
        { uuid: '0', type: 'query' },
        { forceSelect: args.forceSelect, event: args.event, option: args.option }
      );
      reducerTester<TemplatingState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(selectVariableOption(payload))
        .thenStateShouldEqual({
          ...initialState,
          variables: {
            '0': {
              ...initialState.variables[0],
              variable: ({
                ...initialState.variables[0].variable,
                options: args.expOps,
                current: args.expCurr,
              } as unknown) as VariableModel,
              picker: {
                ...initialState.variables[0].picker,
                oldVariableText: null,
                options: args.expOps,
                selectedValues: args.expSel,
              },
            },
          },
          uuidInEditor: null,
        });
    };

    describe('selectVariableOption for multi value variable', () => {
      const multi = true;
      describe('and options with All selected', () => {
        const options = opsAll;
        it.each`
          option    | forceSelect | event     | expOps    | expCurr                                         | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${false}    | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${false}    | ${nullEv} | ${opsAll} | ${{ text: 'All', value: ['$__all'], tags: [] }} | ${opAllSel}
          ${opA}    | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsAll} | ${{ text: 'All', value: ['$__all'], tags: [] }} | ${opAllSel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A selected', () => {
        const options = opsA;
        it.each`
          option    | forceSelect | event     | expOps    | expCurr                                         | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${false}    | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${false}    | ${nullEv} | ${opsAll} | ${{ text: 'All', value: ['$__all'], tags: [] }} | ${opAllSel}
          ${opA}    | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}        | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsAll} | ${{ text: 'All', value: ['$__all'], tags: [] }} | ${opAllSel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with B selected', () => {
        const options = opsB;
        it.each`
          option    | forceSelect | event     | expOps    | expCurr                                           | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsAB}  | ${{ text: 'A + B', value: ['A', 'B'], tags: [] }} | ${opABSel}
          ${opANot} | ${false}    | ${nullEv} | ${opsAB}  | ${{ text: 'A + B', value: ['A', 'B'], tags: [] }} | ${opABSel}
          ${opANot} | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}          | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}          | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsAB}  | ${{ text: 'A + B', value: ['A', 'B'], tags: [] }} | ${opABSel}
          ${opA}    | ${false}    | ${nullEv} | ${opsB}   | ${{ text: 'B', value: ['B'], tags: [] }}          | ${opBSel}
          ${opA}    | ${true}     | ${event}  | ${opsA}   | ${{ text: 'A', value: ['A'], tags: [] }}          | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsAll} | ${{ text: 'All', value: ['$__all'], tags: [] }}   | ${opAllSel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A + B selected', () => {});
    });

    describe('selectVariableOption for single value variable', () => {
      const multi = false;
      describe('and options with All selected', () => {
        const options = opsAll;
        it.each`
          option    | forceSelect | event     | expOps  | expCurr                                | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A selected', () => {
        const options = opsA;
        it.each`
          option    | forceSelect | event     | expOps  | expCurr                                | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with B selected', () => {
        const options = opsB;
        it.each`
          option    | forceSelect | event     | expOps  | expCurr                                | expSel
          ${opANot} | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opANot} | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${nullEv} | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${true}     | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
          ${opA}    | ${false}    | ${event}  | ${opsA} | ${{ text: 'A', value: 'A', tags: [] }} | ${opASel}
        `(
          'when selectVariableOption is dispatched and options: N/A, option: $option, forceSelect: $forceSelect, event: $event, expOps: N/A, expCurr: $expCurr, expSel: N/A',
          ({ option, forceSelect, event, expOps, expCurr, expSel }) =>
            expectSelectVariableOptionState({
              options,
              multi,
              option,
              event,
              forceSelect,
              expCurr,
              expOps,
              expSel,
            })
        );
      });
    });
  });
});
