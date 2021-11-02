import { __assign } from "tslib";
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { LoadingState } from '@grafana/data';
import { queryBuilder } from '../../shared/testing/builders';
import { optionPickerFactory } from './OptionsPicker';
import { initialState } from './reducer';
var defaultVariable = queryBuilder()
    .withId('query0')
    .withName('query0')
    .withMulti()
    .withCurrent(['A', 'C'])
    .withOptions('A', 'B', 'C')
    .build();
function setupTestContext(_a) {
    var _b;
    var _c = _a === void 0 ? {} : _a, _d = _c.pickerState, pickerState = _d === void 0 ? {} : _d, _e = _c.variable, variable = _e === void 0 ? {} : _e;
    var v = __assign(__assign({}, defaultVariable), variable);
    var onVariableChange = jest.fn();
    var props = {
        variable: v,
        onVariableChange: onVariableChange,
    };
    var Picker = optionPickerFactory();
    var optionsPicker = __assign(__assign({}, initialState), pickerState);
    var dispatch = jest.fn();
    var subscribe = jest.fn();
    var getState = jest.fn().mockReturnValue({
        templating: {
            variables: (_b = {},
                _b[v.id] = __assign({}, v),
                _b),
            optionsPicker: optionsPicker,
        },
    });
    var store = { getState: getState, dispatch: dispatch, subscribe: subscribe };
    var rerender = render(React.createElement(Provider, { store: store },
        React.createElement(Picker, __assign({}, props)))).rerender;
    return { onVariableChange: onVariableChange, variable: variable, rerender: rerender, dispatch: dispatch };
}
function getSubMenu(text) {
    return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(text));
}
function getOption(text) {
    return screen.getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'));
}
describe('OptionPicker', function () {
    describe('when mounted and picker id is not set', function () {
        it('should render link with correct text', function () {
            setupTestContext();
            expect(getSubMenu('A + C')).toBeInTheDocument();
        });
        it('link text should be clickable', function () {
            var dispatch = setupTestContext().dispatch;
            dispatch.mockClear();
            userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(1);
        });
    });
    describe('when mounted and picker id differs from variable id', function () {
        it('should render link with correct text', function () {
            setupTestContext({
                variable: defaultVariable,
                pickerState: { id: 'Other' },
            });
            expect(getSubMenu('A + C')).toBeInTheDocument();
        });
        it('link text should be clickable', function () {
            var dispatch = setupTestContext({
                variable: defaultVariable,
                pickerState: { id: 'Other' },
            }).dispatch;
            dispatch.mockClear();
            userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(1);
        });
    });
    describe('when mounted and variable is loading', function () {
        it('should render link with correct text and loading indicator should be visible', function () {
            setupTestContext({
                variable: __assign(__assign({}, defaultVariable), { state: LoadingState.Loading }),
            });
            expect(getSubMenu('A + C')).toBeInTheDocument();
            expect(screen.getByLabelText(selectors.components.LoadingIndicator.icon)).toBeInTheDocument();
        });
        it('link text should not be clickable', function () {
            var dispatch = setupTestContext({
                variable: __assign(__assign({}, defaultVariable), { state: LoadingState.Loading }),
            }).dispatch;
            dispatch.mockClear();
            userEvent.click(getSubMenu('A + C'));
            expect(dispatch).toHaveBeenCalledTimes(0);
        });
    });
    describe('when mounted and picker id equals the variable id', function () {
        it('should render input, drop down list with correct options', function () {
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