import { cloneDeep } from 'lodash';
import {
  hideOptions,
  initialState as optionsPickerInitialState,
  moveOptionsHighlight,
  optionsPickerReducer,
  OptionsPickerState,
  showOptions,
  toggleAllOptions,
  toggleOption,
  toggleTag,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
  updateSearchQuery,
} from './reducer';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { QueryVariableModel, VariableTag } from '../../variable';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../../state/types';

const getVariableTestContext = (extend: Partial<OptionsPickerState>) => {
  return {
    initialState: {
      ...optionsPickerInitialState,
      ...extend,
    },
  };
};

describe('optionsPickerReducer', () => {
  describe('when toggleOption is dispatched', () => {
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
    const opASel = [{ text: 'A', value: 'A', selected: true }];
    const opBSel = [{ text: 'B', value: 'B', selected: true }];
    const opAllSel = [{ text: 'All', value: '$__all', selected: true }];
    const opABSel = [
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: true },
    ];

    const expectToggleOptionState = (args: {
      options: any;
      multi: any;
      forceSelect: any;
      clearOthers: any;
      option: any;
      expOps: any;
      expSel: any;
    }) => {
      const { initialState } = getVariableTestContext({ options: args.options, multi: args.multi });
      const payload = { forceSelect: args.forceSelect, clearOthers: args.clearOthers, option: args.option };

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleOption(payload))
        .thenStateShouldEqual({
          ...initialState,
          selectedValues: args.expSel,
          options: args.expOps,
        });
    };

    describe('toggleOption for multi value variable', () => {
      const multi = true;
      describe('and options with All selected', () => {
        const options = opsAll;
        it.each`
          option    | forceSelect | clearOthers | expOps    | expSel
          ${opANot} | ${true}     | ${false}    | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${false}    | ${opsA}   | ${opASel}
          ${opANot} | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${false}    | ${opsAll} | ${opAllSel}
          ${opA}    | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsAll} | ${opAllSel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A selected', () => {
        const options = opsA;
        it.each`
          option    | forceSelect | clearOthers | expOps    | expSel
          ${opANot} | ${true}     | ${false}    | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${false}    | ${opsA}   | ${opASel}
          ${opANot} | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${false}    | ${opsAll} | ${opAllSel}
          ${opA}    | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsAll} | ${opAllSel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with B selected', () => {
        const options = opsB;
        it.each`
          option    | forceSelect | clearOthers | expOps    | expSel
          ${opANot} | ${true}     | ${false}    | ${opsAB}  | ${opABSel}
          ${opANot} | ${false}    | ${false}    | ${opsAB}  | ${opABSel}
          ${opANot} | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsAB}  | ${opABSel}
          ${opA}    | ${false}    | ${false}    | ${opsB}   | ${opBSel}
          ${opA}    | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsAll} | ${opAllSel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A + B selected', () => {
        const options = opsAB;
        it.each`
          option    | forceSelect | clearOthers | expOps    | expSel
          ${opANot} | ${true}     | ${false}    | ${opsAB}  | ${opABSel}
          ${opANot} | ${false}    | ${false}    | ${opsAB}  | ${opABSel}
          ${opANot} | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsAB}  | ${opABSel}
          ${opA}    | ${false}    | ${false}    | ${opsB}   | ${opBSel}
          ${opA}    | ${true}     | ${true}     | ${opsA}   | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsAll} | ${opAllSel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
    });

    describe('toggleOption for single value variable', () => {
      const multi = false;
      describe('and options with All selected', () => {
        const options = opsAll;
        it.each`
          option    | forceSelect | clearOthers | expOps  | expSel
          ${opANot} | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsA} | ${opASel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with A selected', () => {
        const options = opsA;
        it.each`
          option    | forceSelect | clearOthers | expOps  | expSel
          ${opANot} | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsA} | ${opASel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
      describe('and options with B selected', () => {
        const options = opsB;
        it.each`
          option    | forceSelect | clearOthers | expOps  | expSel
          ${opANot} | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opANot} | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opANot} | ${false}    | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${false}    | ${opsA} | ${opASel}
          ${opA}    | ${true}     | ${true}     | ${opsA} | ${opASel}
          ${opA}    | ${false}    | ${true}     | ${opsA} | ${opASel}
        `(
          'when toggleOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
          ({ option, forceSelect, clearOthers, expOps, expSel }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expOps,
              expSel,
            })
        );
      });
    });
  });

  describe('when showOptions is dispatched and picker has queryValue and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const query = '*.__searchFilter';
      const queryValue = 'a search query';
      const selected = { text: 'All', value: '$__all', selected: true };
      const { initialState } = getVariableTestContext({});
      const payload = {
        type: 'query',
        query,
        options: [selected, { text: 'A', value: 'A', selected: false }, { text: 'B', value: 'B', selected: false }],
        multi: false,
        uuid: '0',
        queryValue,
      } as QueryVariableModel;

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: payload.options,
          queryValue,
          uuid: payload.uuid!,
          multi: payload.multi,
          selectedValues: [selected],
        });
    });
  });

  describe('when showOptions is dispatched and queryValue and variable has no searchFilter', () => {
    it('then state should be correct', () => {
      const query = '*.';
      const queryValue: any = null;
      const current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
      const options = [
        { text: 'All', value: '$__all', selected: true },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const { initialState } = getVariableTestContext({});
      const payload = { type: 'query', uuid: '0', current, query, options, queryValue } as QueryVariableModel;

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          uuid: '0',
          queryValue: '',
          selectedValues: [
            {
              text: ALL_VARIABLE_TEXT,
              selected: true,
              value: ALL_VARIABLE_VALUE,
            },
          ],
          options: options,
        });
    });
  });

  describe('when hideOptions is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: true },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        queryValue: 'a search',
        highlightIndex: 1,
        uuid: '0',
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(hideOptions())
        .thenStateShouldEqual({ ...optionsPickerInitialState });
    });
  });

  describe('when toggleTag is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        tags: [
          { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] },
          { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
          { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
        ],
        options: [
          { text: 'A', selected: false, value: 'A' },
          { text: 'AA', selected: false, value: 'AA' },
          { text: 'AAA', selected: false, value: 'AAA' },
          { text: 'B', selected: false, value: 'B' },
        ],
      });
      const payload: VariableTag = { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] };
      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleTag(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'A', selected: true, value: 'A' },
            { text: 'AA', selected: true, value: 'AA' },
            { text: 'AAA', selected: true, value: 'AAA' },
            { text: 'B', selected: false, value: 'B' },
          ],
          tags: [
            { text: 'All A:s', selected: true, values: ['A', 'AA', 'AAA'], valuesText: 'A + AA + AAA' },
            { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
            { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
          ],
          selectedValues: [
            { text: 'A', selected: true, value: 'A' },
            { text: 'AA', selected: true, value: 'AA' },
            { text: 'AAA', selected: true, value: 'AAA' },
          ],
        });
    });
  });

  describe('when toggleTag is dispatched and ALL is previous selected', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        tags: [
          { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] },
          { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
          { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
        ],
        options: [
          { text: ALL_VARIABLE_TEXT, selected: true, value: ALL_VARIABLE_VALUE },
          { text: 'A', selected: false, value: 'A' },
          { text: 'AA', selected: false, value: 'AA' },
          { text: 'AAA', selected: false, value: 'AAA' },
          { text: 'B', selected: false, value: 'B' },
        ],
      });
      const payload: VariableTag = { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] };
      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleTag(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: ALL_VARIABLE_TEXT, selected: false, value: ALL_VARIABLE_VALUE },
            { text: 'A', selected: true, value: 'A' },
            { text: 'AA', selected: true, value: 'AA' },
            { text: 'AAA', selected: true, value: 'AAA' },
            { text: 'B', selected: false, value: 'B' },
          ],
          tags: [
            { text: 'All A:s', selected: true, values: ['A', 'AA', 'AAA'], valuesText: 'A + AA + AAA' },
            { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
            { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
          ],
          selectedValues: [
            { text: 'A', selected: true, value: 'A' },
            { text: 'AA', selected: true, value: 'AA' },
            { text: 'AAA', selected: true, value: 'AAA' },
          ],
        });
    });
  });

  describe('when toggleTag is dispatched and only the tag is previous selected', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        tags: [
          { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] },
          { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
          { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
          { text: 'All D:s', selected: true, values: ['D'] },
        ],
        options: [
          { text: ALL_VARIABLE_TEXT, selected: false, value: ALL_VARIABLE_VALUE },
          { text: 'A', selected: false, value: 'A' },
          { text: 'AA', selected: false, value: 'AA' },
          { text: 'AAA', selected: false, value: 'AAA' },
          { text: 'B', selected: false, value: 'B' },
        ],
      });
      const payload: VariableTag = { text: 'All D:s', selected: true, values: ['D'] };
      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleTag(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: ALL_VARIABLE_TEXT, selected: true, value: ALL_VARIABLE_VALUE },
            { text: 'A', selected: false, value: 'A' },
            { text: 'AA', selected: false, value: 'AA' },
            { text: 'AAA', selected: false, value: 'AAA' },
            { text: 'B', selected: false, value: 'B' },
          ],
          tags: [
            { text: 'All A:s', selected: false, values: ['A', 'AA', 'AAA'] },
            { text: 'All B:s', selected: false, values: ['B', 'BB', 'BBB'] },
            { text: 'All C:s', selected: false, values: ['C', 'CC', 'CCC'] },
            { text: 'All D:s', selected: false, values: ['D'] },
          ],
          selectedValues: [{ text: ALL_VARIABLE_TEXT, selected: true, value: ALL_VARIABLE_VALUE }],
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 0', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ highlightIndex: 0 });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(moveOptionsHighlight(-1))
        .thenStateShouldEqual({
          ...initialState,
          highlightIndex: 0,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 1', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        highlightIndex: 1,
        options: [
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(moveOptionsHighlight(-1))
        .thenStateShouldEqual({
          ...initialState,
          highlightIndex: 0,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is same as options.length', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        highlightIndex: 1,
        options: [
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(moveOptionsHighlight(1))
        .thenStateShouldEqual({
          ...initialState,
          highlightIndex: 1,
        });
    });
  });

  describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is below options.length', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        highlightIndex: 0,
        options: [
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(moveOptionsHighlight(1))
        .thenStateShouldEqual({
          ...initialState,
          highlightIndex: 1,
        });
    });
  });

  describe('when toggleAllOptions is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        multi: true,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleAllOptions())
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: true },
          ],
        });
    });
  });

  describe('when updateOptionsAndFilter is dispatched and searchFilter exists', () => {
    it('then state should be correct', () => {
      const searchQuery = 'A';

      const options = [
        { text: 'All', value: '$__all', selected: true },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];

      const { initialState } = getVariableTestContext({
        queryValue: searchQuery,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateOptionsAndFilter(options))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
          ],
          selectedValues: [{ text: 'All', value: '$__all', selected: true }],
          queryValue: searchQuery,
          highlightIndex: 0,
        });
    });
  });

  describe('when updateOptionsFromSearch is dispatched and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const searchQuery = '__searchFilter';
      const options = [
        { text: 'All', value: '$__all', selected: true },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const { initialState } = getVariableTestContext({
        queryValue: searchQuery,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateOptionsFromSearch(options))
        .thenStateShouldEqual({
          ...initialState,
          options: options,
          selectedValues: [{ text: 'All', value: '$__all', selected: true }],
          highlightIndex: 0,
        });
    });
  });

  describe('when updateSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      const searchQuery = 'A';
      const { initialState } = getVariableTestContext({});

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateSearchQuery(searchQuery))
        .thenStateShouldEqual({
          ...initialState,
          queryValue: searchQuery,
        });
    });
  });
});
