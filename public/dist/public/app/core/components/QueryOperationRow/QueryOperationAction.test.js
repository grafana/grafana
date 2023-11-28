import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { QueryOperationAction, QueryOperationToggleAction } from './QueryOperationAction';
describe('QueryOperationAction tests', () => {
    function setup(propOverrides) {
        const props = Object.assign({ icon: 'panel-add', title: 'test', onClick: jest.fn(), disabled: false }, propOverrides);
        render(React.createElement(QueryOperationAction, Object.assign({}, props)));
    }
    it('should render component', () => {
        setup();
        expect(screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') })).toBeInTheDocument();
    });
    it('should call on click handler', () => __awaiter(void 0, void 0, void 0, function* () {
        const clickSpy = jest.fn();
        setup({ disabled: false, onClick: clickSpy });
        expect(clickSpy).not.toHaveBeenCalled();
        const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });
        yield userEvent.click(queryButton);
        expect(clickSpy).toHaveBeenCalled();
    }));
    it('should not call on click handler when disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const clickSpy = jest.fn();
        setup({ disabled: true, onClick: clickSpy });
        expect(clickSpy).not.toHaveBeenCalled();
        const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });
        yield userEvent.click(queryButton);
        expect(clickSpy).not.toHaveBeenCalled();
    }));
});
describe('QueryOperationToggleAction', () => {
    function setup(active) {
        const props = {
            icon: 'panel-add',
            title: 'test',
            onClick: () => { },
            active,
        };
        return render(React.createElement(QueryOperationToggleAction, Object.assign({}, props)));
    }
    it('should correctly set pressed state', () => {
        setup(false);
        expect(screen.getByRole('button', {
            name: selectors.components.QueryEditorRow.actionButton('test'),
            pressed: false,
        })).toBeInTheDocument();
        setup(true);
        expect(screen.getByRole('button', {
            name: selectors.components.QueryEditorRow.actionButton('test'),
            pressed: true,
        })).toBeInTheDocument();
    });
});
//# sourceMappingURL=QueryOperationAction.test.js.map