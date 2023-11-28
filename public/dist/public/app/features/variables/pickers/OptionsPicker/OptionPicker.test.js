import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { queryBuilder } from '../../shared/testing/builders';
import { getPreloadedState } from '../../state/helpers';
import { optionPickerFactory } from './OptionsPicker';
import { initialOptionPickerState } from './reducer';
const defaultVariable = queryBuilder()
    .withId('query0')
    .withRootStateKey('key')
    .withName('query0')
    .withMulti()
    .withCurrent(['A', 'C'])
    .withOptions('A', 'B', 'C')
    .build();
function setupTestContext({ pickerState = {}, variable = {} } = {}) {
    const v = Object.assign(Object.assign({}, defaultVariable), variable);
    const onVariableChange = jest.fn();
    const props = {
        variable: v,
        onVariableChange,
        readOnly: false,
    };
    const Picker = optionPickerFactory();
    const optionsPicker = Object.assign(Object.assign({}, initialOptionPickerState), pickerState);
    const dispatch = jest.fn();
    const subscribe = jest.fn();
    const templatingState = {
        variables: {
            [v.id]: Object.assign({}, v),
        },
        optionsPicker,
    };
    const getState = jest.fn().mockReturnValue(getPreloadedState('key', templatingState));
    const store = { getState, dispatch, subscribe };
    const { rerender } = render(React.createElement(Provider, { store: store },
        React.createElement(Picker, Object.assign({}, props))));
    return { onVariableChange, variable, rerender, dispatch };
}
function getSubMenu(text) {
    return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(text));
}
function getOption(text) {
    return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'));
}
describe('OptionPicker', () => {
    describe('when mounted and picker id is not set', () => {
        it('should render link with correct text', () => {
            setupTestContext();
            expect(getSubMenu('A + C')).toBeInTheDocument();
        });
        it('link text should be clickable', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch } = setupTestContext();
            dispatch.mockClear();
            yield userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(1);
        }));
    });
    describe('when mounted and picker id differs from variable id', () => {
        it('should render link with correct text', () => {
            setupTestContext({
                variable: defaultVariable,
                pickerState: { id: 'Other' },
            });
            expect(getSubMenu('A + C')).toBeInTheDocument();
        });
        it('link text should be clickable', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch } = setupTestContext({
                variable: defaultVariable,
                pickerState: { id: 'Other' },
            });
            dispatch.mockClear();
            yield userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(1);
        }));
    });
    describe('when mounted and variable is loading', () => {
        it('should render link with correct text and loading indicator should be visible', () => {
            setupTestContext({
                variable: Object.assign(Object.assign({}, defaultVariable), { state: LoadingState.Loading }),
            });
            expect(getSubMenu('A + C')).toBeInTheDocument();
            expect(screen.getByLabelText(selectors.components.LoadingIndicator.icon)).toBeInTheDocument();
        });
        it('link text should not be clickable', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch } = setupTestContext({
                variable: Object.assign(Object.assign({}, defaultVariable), { state: LoadingState.Loading }),
            });
            dispatch.mockClear();
            yield userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(0);
        }));
    });
    describe('when mounted and picker id equals the variable id', () => {
        it('should render input, drop down list with correct options', () => {
            setupTestContext({
                variable: defaultVariable,
                pickerState: { id: defaultVariable.id, options: defaultVariable.options, multi: defaultVariable.multi },
            });
            expect(screen.getByRole('textbox')).toBeInTheDocument();
            expect(screen.getByRole('textbox')).toHaveValue('');
            expect(screen.getByLabelText(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown)).toBeInTheDocument();
            expect(getOption('A')).toBeInTheDocument();
            expect(getOption('B')).toBeInTheDocument();
            expect(getOption('C')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=OptionPicker.test.js.map