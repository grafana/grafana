import { cloneDeep } from 'lodash';
import {
  optionsPickerReducer,
  VariableOptionsPickerState,
  initialState,
  selectVariableOption,
  showVariableDropDown,
} from './reducer';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { VariableWithMultiSupport } from '../../variable';

const getVariableTestContext = (extend: Partial<VariableOptionsPickerState>) => {
  return {
    initialState: {
      ...initialState,
      ...extend,
    },
  };
};

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
    clearOthers: any;
    option: any;
    expOps: any;
    expSel: any;
  }) => {
    const { initialState } = getVariableTestContext({ options: args.options, multi: args.multi });
    const payload = { forceSelect: args.forceSelect, clearOthers: args.clearOthers, option: args.option };

    reducerTester<VariableOptionsPickerState>()
      .givenReducer(optionsPickerReducer, cloneDeep(initialState))
      .whenActionIsDispatched(selectVariableOption(payload))
      .thenStateShouldEqual({
        ...initialState,
        selectedValues: args.expSel,
        options: args.expOps,
      });
  };

  describe('selectVariableOption for multi value variable', () => {
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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

  describe('selectVariableOption for single value variable', () => {
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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
        'when selectVariableOption is dispatched and option: $option, forceSelect: $forceSelect, clearOthers: $clearOthers, expOps: $expOps, expSel: $expSel',
        ({ option, forceSelect, clearOthers, expOps, expSel }) =>
          expectSelectVariableOptionState({
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

describe('when showVariableDropDown is dispatched and picker has an oldVariableText and searchQuery and variable has searchFilter', () => {
  it('then state should be correct', () => {
    const query = '*.__searchFilter';
    const searchQuery = 'a search query';
    const { initialState } = getVariableTestContext({
      searchQuery,
    });

    const selected = { text: 'All', value: '$__all', selected: true };

    const payload = {
      query,
      options: [selected, { text: 'A', value: 'A', selected: false }, { text: 'B', value: 'B', selected: false }],
      multi: false,
      uuid: '0',
    } as VariableWithMultiSupport;

    reducerTester<VariableOptionsPickerState>()
      .givenReducer(optionsPickerReducer, cloneDeep(initialState))
      .whenActionIsDispatched(showVariableDropDown(payload))
      .thenStateShouldEqual({
        ...initialState,
        options: payload.options,
        searchQuery,
        uuid: payload.uuid,
        multi: payload.multi,
        selectedValues: [selected],
      });
  });
});
