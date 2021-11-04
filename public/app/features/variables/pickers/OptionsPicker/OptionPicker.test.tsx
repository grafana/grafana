import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { LoadingState } from '@grafana/data';

import { VariablePickerProps } from '../types';
import { QueryVariableModel, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { queryBuilder } from '../../shared/testing/builders';
import { optionPickerFactory } from './OptionsPicker';
import { initialState, OptionsPickerState } from './reducer';

interface Args {
  pickerState?: Partial<OptionsPickerState>;
  variable?: Partial<QueryVariableModel>;
}

const defaultVariable = queryBuilder()
  .withId('query0')
  .withName('query0')
  .withMulti()
  .withCurrent(['A', 'C'])
  .withOptions('A', 'B', 'C')
  .build();

function setupTestContext({ pickerState = {}, variable = {} }: Args = {}) {
  const v = {
    ...defaultVariable,
    ...variable,
  };
  const onVariableChange = jest.fn();
  const props: VariablePickerProps<VariableWithMultiSupport | VariableWithOptions> = {
    variable: v,
    onVariableChange,
  };
  const Picker = optionPickerFactory();
  const optionsPicker: OptionsPickerState = { ...initialState, ...pickerState };
  const dispatch = jest.fn();
  const subscribe = jest.fn();
  const getState = jest.fn().mockReturnValue({
    templating: {
      variables: {
        [v.id]: { ...v },
      },
      optionsPicker,
    },
  });
  const store: any = { getState, dispatch, subscribe };
  const { rerender } = render(
    <Provider store={store}>
      <Picker {...props} />
    </Provider>
  );
  return { onVariableChange, variable, rerender, dispatch };
}

function getSubMenu(text: string) {
  return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(text));
}

function getOption(text: string) {
  return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'));
}

describe('OptionPicker', () => {
  describe('when mounted and picker id is not set', () => {
    it('should render link with correct text', () => {
      setupTestContext();
      expect(getSubMenu('A + C')).toBeInTheDocument();
    });

    it('link text should be clickable', () => {
      const { dispatch } = setupTestContext();

      dispatch.mockClear();
      userEvent.click(getSubMenu('A + C'));
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when mounted and picker id differs from variable id', () => {
    it('should render link with correct text', () => {
      setupTestContext({
        variable: defaultVariable,
        pickerState: { id: 'Other' },
      });
      expect(getSubMenu('A + C')).toBeInTheDocument();
    });

    it('link text should be clickable', () => {
      const { dispatch } = setupTestContext({
        variable: defaultVariable,
        pickerState: { id: 'Other' },
      });

      dispatch.mockClear();
      userEvent.click(getSubMenu('A + C'));
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when mounted and variable is loading', () => {
    it('should render link with correct text and loading indicator should be visible', () => {
      setupTestContext({
        variable: { ...defaultVariable, state: LoadingState.Loading },
      });
      expect(getSubMenu('A + C')).toBeInTheDocument();
      expect(screen.getByLabelText(selectors.components.LoadingIndicator.icon)).toBeInTheDocument();
    });

    it('link text should not be clickable', () => {
      const { dispatch } = setupTestContext({
        variable: { ...defaultVariable, state: LoadingState.Loading },
      });

      dispatch.mockClear();
      userEvent.click(getSubMenu('A + C'));
      expect(dispatch).toHaveBeenCalledTimes(0);
    });
  });

  describe('when mounted and picker id equals the variable id', () => {
    it('should render input, drop down list with correct options', () => {
      setupTestContext({
        variable: defaultVariable,
        pickerState: { id: defaultVariable.id, options: defaultVariable.options, multi: defaultVariable.multi },
      });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(
        screen.getByLabelText(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown)
      ).toBeInTheDocument();
      expect(getOption('A')).toBeInTheDocument();
      expect(getOption('B')).toBeInTheDocument();
      expect(getOption('C')).toBeInTheDocument();
    });
  });
});
