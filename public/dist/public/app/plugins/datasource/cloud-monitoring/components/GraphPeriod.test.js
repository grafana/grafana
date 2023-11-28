import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { select } from 'react-select-event';
import { GraphPeriod } from './GraphPeriod';
const props = {
    onChange: jest.fn(),
    refId: 'A',
    variableOptionGroup: { options: [] },
};
describe('Graph Period', () => {
    it('should enable graph_period by default', () => {
        render(React.createElement(GraphPeriod, Object.assign({}, props)));
        expect(screen.getByLabelText('Graph period')).not.toBeDisabled();
    });
    it('should disable graph_period when toggled', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(GraphPeriod, Object.assign({}, props, { onChange: onChange })));
        const s = screen.getByTestId('A-switch-graph-period');
        yield userEvent.click(s);
        expect(onChange).toHaveBeenCalledWith('disabled');
    }));
    it('should set a different value when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(GraphPeriod, Object.assign({}, props, { onChange: onChange })));
        const selectEl = screen.getByLabelText('Graph period');
        expect(selectEl).toBeInTheDocument();
        yield select(selectEl, '1m', {
            container: document.body,
        });
        expect(onChange).toHaveBeenCalledWith('1m');
    }));
});
//# sourceMappingURL=GraphPeriod.test.js.map