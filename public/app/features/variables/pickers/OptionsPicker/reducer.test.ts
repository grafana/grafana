import { cloneDeep } from 'lodash';

import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../../constants';
import { QueryVariableModel, VariableOption } from '../../types';

import {
  cleanPickerState,
  hideOptions,
  initialOptionPickerState as optionsPickerInitialState,
  moveOptionsHighlight,
  OPTIONS_LIMIT,
  optionsPickerReducer,
  OptionsPickerState,
  showOptions,
  toggleAllOptions,
  toggleOption,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
  updateSearchQuery,
} from './reducer';

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
      { text: '$__all', value: '$__all', selected: true },
      { text: 'A', value: 'A', selected: false },
      { text: 'B', value: 'B', selected: false },
    ];
    const opsA = [
      { text: '$__all', value: '$__all', selected: false },
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: false },
    ];
    const opsAB = [
      { text: '$__all', value: '$__all', selected: false },
      { text: 'A', value: 'A', selected: true },
      { text: 'B', value: 'B', selected: true },
    ];

    const expectToggleOptionState = (args: {
      options: any;
      multi: any;
      forceSelect: any;
      clearOthers: any;
      option: any;
      expectSelected: any;
    }) => {
      const { initialState } = getVariableTestContext({
        options: args.options,
        multi: args.multi,
        selectedValues: args.options.filter((o: any) => o.selected),
      });
      const payload = {
        forceSelect: args.forceSelect,
        clearOthers: args.clearOthers,
        option: { text: args.option, value: args.option, selected: true },
      };
      const expectedAsRecord: any = args.expectSelected.reduce((all: any, current: any) => {
        all[current] = current;
        return all;
      }, {});

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleOption(payload))
        .thenStateShouldEqual({
          ...initialState,
          selectedValues: args.expectSelected.map((value: any) => ({ value, text: value, selected: true })),
          options: args.options.map((option: any) => {
            return { ...option, selected: !!expectedAsRecord[option.value] };
          }),
        });
    };

    describe('When toggleOption with undefined option is dispatched', () => {
      it('should update selected values', () => {
        const { initialState } = getVariableTestContext({
          options: [],
          selectedValues: [],
        });
        const payload = {
          forceSelect: false,
          clearOthers: true,
          option: undefined,
        };
        reducerTester<OptionsPickerState>()
          .givenReducer(optionsPickerReducer, cloneDeep(initialState))
          .whenActionIsDispatched(toggleOption(payload))
          .thenStateShouldEqual({
            ...initialState,
            selectedValues: [],
            options: [],
          });
      });
    });

    describe('toggleOption for multi value variable', () => {
      const multi = true;
      describe('and value All is selected in options', () => {
        const options = opsAll;
        it.each`
          option      | forceSelect | clearOthers | expectSelected
          ${'A'}      | ${true}     | ${false}    | ${['A']}
          ${'A'}      | ${false}    | ${false}    | ${['A']}
          ${'A'}      | ${true}     | ${true}     | ${['A']}
          ${'A'}      | ${false}    | ${true}     | ${['A']}
          ${'B'}      | ${true}     | ${false}    | ${['B']}
          ${'B'}      | ${false}    | ${false}    | ${['B']}
          ${'B'}      | ${true}     | ${true}     | ${['B']}
          ${'B'}      | ${false}    | ${true}     | ${['B']}
          ${'$__all'} | ${true}     | ${false}    | ${['$__all']}
          ${'$__all'} | ${false}    | ${false}    | ${['$__all']}
          ${'$__all'} | ${true}     | ${true}     | ${['$__all']}
          ${'$__all'} | ${false}    | ${true}     | ${['$__all']}
        `(
          'and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected',
          ({ option, forceSelect, clearOthers, expectSelected }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expectSelected,
            })
        );
      });

      describe('and value A is selected in options', () => {
        const options = opsA;
        it.each`
          option | forceSelect | clearOthers | expectSelected
          ${'A'} | ${true}     | ${false}    | ${['A']}
          ${'A'} | ${false}    | ${false}    | ${['$__all']}
          ${'A'} | ${true}     | ${true}     | ${['A']}
          ${'A'} | ${false}    | ${true}     | ${['$__all']}
          ${'B'} | ${true}     | ${true}     | ${['B']}
          ${'B'} | ${false}    | ${true}     | ${['B']}
          ${'B'} | ${true}     | ${false}    | ${['A', 'B']}
          ${'B'} | ${false}    | ${false}    | ${['A', 'B']}
        `(
          'and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected',
          ({ option, forceSelect, clearOthers, expectSelected }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expectSelected,
            })
        );
      });

      describe('and values A + B is selected in options', () => {
        const options = opsAB;
        it.each`
          option | forceSelect | clearOthers | expectSelected
          ${'A'} | ${true}     | ${false}    | ${['A', 'B']}
          ${'A'} | ${false}    | ${false}    | ${['B']}
          ${'A'} | ${true}     | ${true}     | ${['A']}
          ${'A'} | ${false}    | ${true}     | ${['$__all']}
          ${'B'} | ${true}     | ${true}     | ${['B']}
          ${'B'} | ${false}    | ${true}     | ${['$__all']}
          ${'B'} | ${true}     | ${false}    | ${['A', 'B']}
          ${'B'} | ${false}    | ${false}    | ${['A']}
        `(
          'and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected',
          ({ option, forceSelect, clearOthers, expectSelected }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expectSelected,
            })
        );
      });
    });

    describe('toggleOption for single value variable', () => {
      const multi = false;
      describe('and value All is selected in options', () => {
        const options = opsAll;
        it.each`
          option      | forceSelect | clearOthers | expectSelected
          ${'A'}      | ${true}     | ${false}    | ${['A']}
          ${'A'}      | ${false}    | ${false}    | ${['A']}
          ${'A'}      | ${true}     | ${true}     | ${['A']}
          ${'A'}      | ${false}    | ${true}     | ${['A']}
          ${'B'}      | ${true}     | ${false}    | ${['B']}
          ${'B'}      | ${false}    | ${false}    | ${['B']}
          ${'B'}      | ${true}     | ${true}     | ${['B']}
          ${'B'}      | ${false}    | ${true}     | ${['B']}
          ${'$__all'} | ${true}     | ${false}    | ${['$__all']}
          ${'$__all'} | ${false}    | ${false}    | ${['$__all']}
          ${'$__all'} | ${true}     | ${true}     | ${['$__all']}
          ${'$__all'} | ${false}    | ${true}     | ${['$__all']}
        `(
          'and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected',
          ({ option, forceSelect, clearOthers, expectSelected }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expectSelected,
            })
        );
      });
      describe('and value A is selected in options', () => {
        const options = opsA;
        it.each`
          option | forceSelect | clearOthers | expectSelected
          ${'A'} | ${true}     | ${false}    | ${['A']}
          ${'A'} | ${false}    | ${false}    | ${['$__all']}
          ${'A'} | ${true}     | ${true}     | ${['A']}
          ${'A'} | ${false}    | ${true}     | ${['$__all']}
          ${'B'} | ${true}     | ${false}    | ${['B']}
          ${'B'} | ${false}    | ${false}    | ${['B']}
          ${'B'} | ${true}     | ${true}     | ${['B']}
          ${'B'} | ${false}    | ${true}     | ${['B']}
        `(
          'and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected',
          ({ option, forceSelect, clearOthers, expectSelected }) =>
            expectToggleOptionState({
              options,
              multi,
              option,
              clearOthers,
              forceSelect,
              expectSelected,
            })
        );
      });
    });
  });

  describe('when showOptions is dispatched', () => {
    it('then correct values should be selected', () => {
      const { initialState } = getVariableTestContext({});
      const payload = {
        type: 'query',
        query: '',
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: true },
        ],
        multi: false,
        id: '0',
      } as QueryVariableModel;

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: payload.options,
          id: payload.id,
          multi: payload.multi,
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
          queryValue: '',
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
        id: '0',
        queryValue,
      } as QueryVariableModel;

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: payload.options,
          queryValue,
          id: payload.id,
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
      const payload = { type: 'query', id: '0', current, query, options, queryValue } as QueryVariableModel;

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          id: '0',
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
        id: '0',
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(hideOptions())
        .thenStateShouldEqual({ ...optionsPickerInitialState });
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
          highlightIndex: -1,
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
    it('should toggle all values except All to true', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        selectedValues: [],
        multi: true,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleAllOptions())
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: true },
          ],
        });
    });

    it('should toggle all values to false when $_all is selected', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: true },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: false },
        ],
        selectedValues: [{ text: 'All', value: '$__all', selected: true }],
        multi: true,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleAllOptions())
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          selectedValues: [],
        });
    });

    it('should toggle all values to false when a option is selected', () => {
      const { initialState } = getVariableTestContext({
        options: [
          { text: 'All', value: '$__all', selected: false },
          { text: 'A', value: 'A', selected: false },
          { text: 'B', value: 'B', selected: true },
        ],
        selectedValues: [{ text: 'B', value: 'B', selected: true }],
        multi: true,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleAllOptions())
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          selectedValues: [],
        });
    });
  });

  describe('when updateOptionsAndFilter is dispatched and queryValue exists', () => {
    it('then state should be correct', () => {
      const queryValue = 'A';

      const options = [
        { text: 'All', value: '$__all', selected: true },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];

      const { initialState } = getVariableTestContext({ queryValue });

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
          queryValue: 'A',
          highlightIndex: 0,
        });
    });

    describe('but option is null', () => {
      it('then state should be correct', () => {
        const queryValue = 'A';

        const options: any = [
          { text: 'All', value: '$__all', selected: true },
          { text: null, value: null, selected: false },
          { text: [null], value: [null], selected: false },
        ];

        const { initialState } = getVariableTestContext({ queryValue });

        reducerTester<OptionsPickerState>()
          .givenReducer(optionsPickerReducer, cloneDeep(initialState))
          .whenActionIsDispatched(updateOptionsAndFilter(options))
          .thenStateShouldEqual({
            ...initialState,
            options: [{ text: 'All', value: '$__all', selected: true }],
            selectedValues: [{ text: 'All', value: '$__all', selected: true }],
            queryValue: 'A',
            highlightIndex: 0,
          });
      });
    });

    describe('and option count is are greater then OPTIONS_LIMIT', () => {
      it('then state should be correct', () => {
        const queryValue = 'option:1337';

        const options = [];
        for (let index = 0; index <= OPTIONS_LIMIT + 337; index++) {
          options.push({ text: `option:${index}`, value: `option:${index}`, selected: false });
        }

        const { initialState } = getVariableTestContext({ queryValue });

        reducerTester<OptionsPickerState>()
          .givenReducer(optionsPickerReducer, cloneDeep(initialState))
          .whenActionIsDispatched(updateOptionsAndFilter(options))
          .thenStateShouldEqual({
            ...cloneDeep(initialState),
            options: [{ text: 'option:1337', value: 'option:1337', selected: false }],
            selectedValues: [],
            queryValue: 'option:1337',
            highlightIndex: 0,
          });
      });
    });
  });

  describe('when value is selected and filter is applied but then removed', () => {
    it('then state should be correct', () => {
      const queryValue = 'A';

      const options: VariableOption[] = [
        { text: 'All', value: '$__all', selected: false },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];

      const { initialState } = getVariableTestContext({
        options,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleOption({ option: options[2], forceSelect: false, clearOthers: false }))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
        })
        .whenActionIsDispatched(updateSearchQuery(queryValue))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
          queryValue: 'A',
        })
        .whenActionIsDispatched(updateOptionsAndFilter(options))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
          queryValue: 'A',
          highlightIndex: 0,
        })
        .whenActionIsDispatched(updateSearchQuery(''))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
          queryValue: '',
          highlightIndex: 0,
        })
        .whenActionIsDispatched(updateOptionsAndFilter(options))
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
          queryValue: '',
          highlightIndex: 0,
        });
    });
  });

  describe('when value is toggled back and forth', () => {
    it('then state should be correct', () => {
      const options: VariableOption[] = [
        { text: 'All', value: '$__all', selected: false },
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];

      const toggleOptionAction = toggleOption({
        option: options[2],
        forceSelect: false,
        clearOthers: false,
      });

      const { initialState } = getVariableTestContext({
        options,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(toggleOptionAction)
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
          ],
          selectedValues: [{ text: 'B', value: 'B', selected: true }],
        })
        .whenActionIsDispatched(toggleOptionAction)
        .thenStateShouldEqual({
          ...initialState,
          options: [
            { text: 'All', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
          ],
          selectedValues: [{ text: 'All', value: '$__all', selected: true }],
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

  describe('when large data for updateOptionsAndFilter', () => {
    it('then state should be correct', () => {
      const searchQuery = 'option:11256';

      const options: VariableOption[] = [];
      for (let index = 0; index <= OPTIONS_LIMIT + 11256; index++) {
        options.push({ text: `option:${index}`, value: `option:${index}`, selected: false });
      }

      const { initialState } = getVariableTestContext({
        queryValue: searchQuery,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateOptionsAndFilter(options))
        .thenStateShouldEqual({
          ...cloneDeep(initialState),
          options: [{ text: 'option:11256', value: 'option:11256', selected: false }],
          selectedValues: [],
          queryValue: 'option:11256',
          highlightIndex: 0,
        });
    });
  });

  describe('when large data for updateOptionsFromSearch is dispatched and variable has searchFilter', () => {
    it('then state should be correct', () => {
      const searchQuery = '__searchFilter';
      const options = [{ text: 'All', value: '$__all', selected: true }];

      for (let i = 0; i <= OPTIONS_LIMIT + 137; i++) {
        options.push({ text: `option${i}`, value: `option${i}`, selected: false });
      }
      const { initialState } = getVariableTestContext({
        queryValue: searchQuery,
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateOptionsFromSearch(options))
        .thenStateShouldEqual({
          ...initialState,
          options: options.slice(0, OPTIONS_LIMIT),
          selectedValues: [{ text: 'All', value: '$__all', selected: true }],
          highlightIndex: 0,
        });
    });
  });

  describe('when large data for showOptions', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({});
      const payload = {
        type: 'query',
        query: '',
        options: [{ text: 'option0', value: 'option0', selected: false }],
        multi: false,
        id: '0',
      } as QueryVariableModel;
      const checkOptions = [];
      for (let index = 0; index < OPTIONS_LIMIT; index++) {
        checkOptions.push({ text: `option${index}`, value: `option${index}`, selected: false });
      }
      for (let i = 1; i <= OPTIONS_LIMIT + 137; i++) {
        payload.options.push({ text: `option${i}`, value: `option${i}`, selected: false });
      }

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(showOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          options: checkOptions,
          id: '0',
          multi: false,
          queryValue: '',
        });
    });
  });

  describe('when cleanPickerState is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({
        highlightIndex: 19,
        multi: true,
        id: 'some id',
        options: [{ text: 'A', value: 'A', selected: true }],
        queryValue: 'a query value',
        selectedValues: [{ text: 'A', value: 'A', selected: true }],
      });

      reducerTester<OptionsPickerState>()
        .givenReducer(optionsPickerReducer, cloneDeep(initialState))
        .whenActionIsDispatched(cleanPickerState())
        .thenStateShouldEqual({ ...optionsPickerInitialState });
    });
  });
});
