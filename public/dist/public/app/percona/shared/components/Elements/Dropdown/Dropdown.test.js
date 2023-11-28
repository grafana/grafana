import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Dropdown } from './Dropdown';
const Toggle = React.forwardRef(function toggle(props, ref) {
    return (React.createElement("button", Object.assign({ type: "button", ref: ref }, props), "Toggle"));
});
const DATA_QA_MENU = 'dropdown-menu-menu';
const DATA_QA_TOGGLE = 'dropdown-menu-toggle';
describe('Dropdown ::', () => {
    test('should render the toggle', () => {
        render(React.createElement(Dropdown, { toggle: Toggle },
            React.createElement("a", { href: "/" }, "root"),
            React.createElement("a", { href: "/test" }, "test")));
        expect(screen.getByTestId(DATA_QA_TOGGLE)).toBeInTheDocument();
    });
    test('clicking on the toggle toggles the menu visibility', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dropdown, { toggle: Toggle },
            React.createElement("a", { href: "/" }, "root"),
            React.createElement("a", { href: "/test" }, "test")));
        const toggle = yield screen.getByTestId(DATA_QA_TOGGLE);
        expect(screen.queryByTestId(DATA_QA_MENU)).not.toBeInTheDocument();
        yield waitFor(() => fireEvent.click(toggle));
        expect(screen.getByTestId(DATA_QA_MENU)).toBeInTheDocument();
        yield waitFor(() => fireEvent.click(toggle));
        expect(screen.queryByTestId(DATA_QA_MENU)).not.toBeInTheDocument();
    }));
    test('clicking outside the dropdown closes the menu', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement("main", { role: "main" },
            React.createElement(Dropdown, { toggle: Toggle },
                React.createElement("a", { href: "/" }, "root"),
                React.createElement("a", { href: "/test" }, "test"))));
        const toggle = screen.getByTestId(DATA_QA_TOGGLE);
        yield waitFor(() => fireEvent.click(toggle));
        expect(screen.getByTestId(DATA_QA_MENU)).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole('main'));
        expect(screen.queryByTestId(DATA_QA_MENU)).not.toBeInTheDocument();
    }));
    test('mousedown on the dropdown does not close the menu', () => __awaiter(void 0, void 0, void 0, function* () {
        const menuAction = jest.fn();
        render(React.createElement(Dropdown, { toggle: Toggle },
            React.createElement("a", { "data-testid": "menu-item", onClick: menuAction }, "root"),
            React.createElement("a", { href: "/test" }, "test")));
        const toggle = screen.getByTestId(DATA_QA_TOGGLE);
        yield waitFor(() => fireEvent.click(toggle));
        fireEvent.mouseDown(toggle);
        const menu = screen.getByTestId(DATA_QA_MENU);
        fireEvent.mouseDown(menu);
        expect(menu).toBeInTheDocument();
    }));
    test('clicking on a menu item propagates the event and closes the menu', () => __awaiter(void 0, void 0, void 0, function* () {
        const menuAction = jest.fn();
        render(React.createElement(Dropdown, { toggle: Toggle },
            React.createElement("div", { "data-testid": "menu-item", onClick: menuAction }, "root"),
            React.createElement("a", { href: "/test" }, "test")));
        const toggle = screen.getByTestId(DATA_QA_TOGGLE);
        expect(menuAction).toBeCalledTimes(0);
        yield waitFor(() => fireEvent.click(toggle));
        const menuItem = screen.getByTestId('menu-item');
        yield waitFor(() => fireEvent.click(menuItem));
        expect(menuAction).toBeCalledTimes(1);
    }));
    test("doesn't keep menu item active on close", () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dropdown, { toggle: Toggle },
            React.createElement("div", { "data-testid": "menu-item", onClick: jest.fn() }, "root"),
            React.createElement("a", { href: "/test" }, "test")));
        const toggle = yield screen.getByTestId(DATA_QA_TOGGLE);
        yield waitFor(() => fireEvent.click(toggle));
        const menuItem = yield screen.getByTestId('menu-item');
        yield waitFor(() => fireEvent.click(menuItem));
        yield waitFor(() => fireEvent.click(toggle));
        expect(menuItem === null || menuItem === void 0 ? void 0 : menuItem.className.includes('active')).toBeFalsy();
    }));
});
//# sourceMappingURL=Dropdown.test.js.map