import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CoreApp, createTheme, LogLevel } from '@grafana/data';
import { LogRowMessage } from './LogRowMessage';
import { createLogRow } from './__mocks__/logRow';
import { getLogRowStyles } from './getLogRowStyles';
const setup = (propOverrides, rowOverrides) => {
    const theme = createTheme();
    const styles = getLogRowStyles(theme);
    const props = Object.assign({ wrapLogMessage: false, row: createLogRow(Object.assign({ entry: 'test123', logLevel: LogLevel.error, timeEpochMs: 1546297200000 }, rowOverrides)), onOpenContext: () => { }, prettifyLogMessage: false, app: CoreApp.Explore, styles, mouseIsOver: true, onBlur: jest.fn() }, (propOverrides || {}));
    render(React.createElement("table", null,
        React.createElement("tbody", null,
            React.createElement("tr", null,
                React.createElement(LogRowMessage, Object.assign({}, props))))));
    return props;
};
describe('LogRowMessage', () => {
    it('renders row entry', () => {
        setup();
        expect(screen.queryByText('test123')).toBeInTheDocument();
    });
    it('should hide the menu if the mouse is not over', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ showContextToggle: () => true, mouseIsOver: false });
        expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();
    }));
    describe('with show context', () => {
        it('should show context button', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ showContextToggle: () => true });
            yield userEvent.hover(screen.getByText('test123'));
            expect(screen.queryByLabelText('Show context')).toBeInTheDocument();
        }));
        it('should not show context button', () => {
            setup({ showContextToggle: () => false });
            expect(screen.queryByLabelText('Show context')).not.toBeInTheDocument();
        });
        it('should call `onOpenContext` with row on click', () => __awaiter(void 0, void 0, void 0, function* () {
            const showContextToggle = jest.fn();
            const props = setup({ showContextToggle: () => true, onOpenContext: showContextToggle });
            yield userEvent.hover(screen.getByText('test123'));
            const button = screen.getByLabelText('Show context');
            yield userEvent.click(button);
            expect(showContextToggle).toHaveBeenCalledWith(props.row);
        }));
    });
    describe('with permalinking', () => {
        it('should show permalinking button when `onPermalinkClick` is defined and rowId is defined', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ onPermalinkClick: jest.fn() }, { rowId: 'id1' });
            yield userEvent.hover(screen.getByText('test123'));
            expect(screen.queryByLabelText('Copy shortlink')).toBeInTheDocument();
        }));
        it('should not show permalinking button when `onPermalinkClick` is defined and rowId is not defined', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ onPermalinkClick: jest.fn() });
            yield userEvent.hover(screen.getByText('test123'));
            expect(screen.queryByLabelText('Copy shortlink')).not.toBeInTheDocument();
        }));
        it('should not show permalinking button when `onPermalinkClick` is not defined', () => {
            setup();
            expect(screen.queryByLabelText('Copy shortlink')).not.toBeInTheDocument();
        });
        it('should call `onPermalinkClick` with row on click', () => __awaiter(void 0, void 0, void 0, function* () {
            const permalinkClick = jest.fn();
            const props = setup({ onPermalinkClick: permalinkClick }, { rowId: 'id1' });
            yield userEvent.hover(screen.getByText('test123'));
            const button = screen.getByLabelText('Copy shortlink');
            yield userEvent.click(button);
            expect(permalinkClick).toHaveBeenCalledWith(props.row);
        }));
    });
    describe('with pinning', () => {
        describe('for `onPinLine`', () => {
            it('should show pinning button when `onPinLine` is defined', () => __awaiter(void 0, void 0, void 0, function* () {
                setup({ onPinLine: jest.fn() });
                yield userEvent.hover(screen.getByText('test123'));
                expect(screen.queryByLabelText('Pin line')).toBeInTheDocument();
            }));
            it('should not show pinning button when `onPinLine` and `pinned` is defined', () => {
                setup({ onPinLine: jest.fn(), pinned: true });
                expect(screen.queryByLabelText('Pin line')).not.toBeInTheDocument();
            });
            it('should not show pinning button when `onPinLine` is not defined', () => {
                setup();
                expect(screen.queryByLabelText('Pin line')).not.toBeInTheDocument();
            });
            it('should call `onPinLine` on click', () => __awaiter(void 0, void 0, void 0, function* () {
                const onPinLine = jest.fn();
                setup({ onPinLine });
                yield userEvent.hover(screen.getByText('test123'));
                const button = screen.getByLabelText('Pin line');
                yield userEvent.click(button);
                expect(onPinLine).toHaveBeenCalledTimes(1);
            }));
        });
        describe('for `onUnpinLine`', () => {
            it('should not show pinning button when `onUnpinLine` is defined', () => {
                setup({ onUnpinLine: jest.fn() });
                expect(screen.queryByLabelText('Unpin line')).not.toBeInTheDocument();
            });
            it('should show 1 pinning buttons when `onUnpinLine` and `pinned` is defined', () => {
                // we show 1 because we now have an "always visible" menu, the others are rendered on mouse over
                setup({ onUnpinLine: jest.fn(), pinned: true });
                expect(screen.queryAllByLabelText('Unpin line').length).toBe(1);
            });
            it('should not show pinning button when `onUnpinLine` is not defined', () => {
                setup();
                expect(screen.queryByLabelText('Unpin line')).not.toBeInTheDocument();
            });
            it('should call `onUnpinLine` on click', () => __awaiter(void 0, void 0, void 0, function* () {
                const onUnpinLine = jest.fn();
                setup({ onUnpinLine, pinned: true });
                const button = screen.getByLabelText('Unpin line');
                // There's an issue with userEvent and this button, so we use fireEvent instead
                fireEvent.click(button);
                expect(onUnpinLine).toHaveBeenCalledTimes(1);
            }));
        });
    });
});
//# sourceMappingURL=LogRowMessage.test.js.map