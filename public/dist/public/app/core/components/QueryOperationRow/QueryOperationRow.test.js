import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryOperationRow } from './QueryOperationRow';
const setup = (propOverrides) => {
    const props = Object.assign({ title: 'test-title', headerElement: '', index: 0, id: 'test-id', children: React.createElement("div", null, "children") }, propOverrides);
    return render(React.createElement(QueryOperationRow, Object.assign({}, props)));
};
describe('QueryOperationRow', () => {
    it('renders without exploding', () => {
        expect(() => setup()).not.toThrow();
    });
    it('renders the component content', () => {
        setup();
        expect(screen.getByText(/^test-title$/)).toBeInTheDocument();
    });
    describe('callbacks', () => {
        it('should call onOpen when row is opened and onClose when row is collapsed', () => __awaiter(void 0, void 0, void 0, function* () {
            const onOpenSpy = jest.fn();
            const onCloseSpy = jest.fn();
            setup({ isOpen: false, onOpen: onOpenSpy, onClose: onCloseSpy });
            const queryRow = screen.getByText(/^test-title$/);
            expect(queryRow).toBeInTheDocument();
            // open row on click
            yield userEvent.click(queryRow);
            // close row on click
            yield userEvent.click(queryRow);
            expect(onOpenSpy).toBeCalledTimes(1);
            expect(onCloseSpy).toBeCalledTimes(1);
        }));
    });
    describe('headerElement rendering', () => {
        it('should render headerElement provided as element', () => {
            const title = React.createElement("div", { "aria-label": "test title" }, "test-header-element");
            setup({ headerElement: title, id: 'test-id', index: 0 });
            expect(screen.getByText(/^test-header-element$/)).toBeInTheDocument();
        });
        it('should render headerElement provided as function', () => {
            const title = () => React.createElement("div", { "aria-label": "test title" }, "test-function-header");
            setup({ headerElement: title, id: 'test-id', index: 0 });
            expect(screen.getByText(/^test-function-header$/)).toBeInTheDocument();
        });
        it('should expose api to headerElement rendered as function', () => {
            const propsSpy = jest.fn();
            const title = (props) => {
                propsSpy(props);
                return React.createElement("div", { "aria-label": "test title" }, "Test");
            };
            setup({ headerElement: title, id: 'test-id', index: 0 });
            expect(Object.keys(propsSpy.mock.calls[0][0])).toContain('isOpen');
        });
    });
    describe('actions rendering', () => {
        it('should render actions provided as element', () => {
            const actions = React.createElement("div", { "aria-label": "test actions" }, "test-actions");
            setup({ actions: actions, id: 'test-id', index: 0 });
            expect(screen.getByText(/^test-actions$/)).toBeInTheDocument();
        });
        it('should render actions provided as function', () => {
            const actions = () => React.createElement("div", { "aria-label": "test actions" }, "test-actions");
            setup({ actions: actions, id: 'test-id', index: 0 });
            expect(screen.getByText(/^test-actions$/)).toBeInTheDocument();
        });
        it('should expose api to title rendered as function', () => {
            const propsSpy = jest.fn();
            const actions = (props) => {
                propsSpy(props);
                return React.createElement("div", { "aria-label": "test actions" }, "test-actions");
            };
            setup({ actions: actions, id: 'test-id', index: 0 });
            expect(screen.getByText(/^test-actions$/)).toBeInTheDocument();
            expect(Object.keys(propsSpy.mock.calls[0][0])).toEqual(['isOpen', 'onOpen', 'onClose']);
        });
    });
});
//# sourceMappingURL=QueryOperationRow.test.js.map