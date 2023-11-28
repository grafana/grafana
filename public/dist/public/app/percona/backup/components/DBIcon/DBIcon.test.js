import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Tooltip } from '@grafana/ui';
import { svg } from '../../../../../test/mocks/svg';
import { DBIcon } from './DBIcon';
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { Tooltip: jest.fn(() => React.createElement("div", { "data-testid": "tooltip" })) })));
describe('DBIcon', () => {
    it('should not display unknown icons', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DBIcon, { type: 'unknown' }));
        expect(screen.queryAllByRole(svg)).toHaveLength(0);
    }));
    it('should display known icons', () => {
        const { container } = render(React.createElement(DBIcon, { type: "edit" }));
        const svg = container.querySelectorAll('svg');
        expect(svg).toHaveLength(1);
    });
    it('should have 22 x 22 icons by default', () => {
        const { container } = render(React.createElement(DBIcon, { type: "edit" }));
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '22');
        expect(svg).toHaveAttribute('height', '22');
    });
    it('should change icon size', () => {
        const { container } = render(React.createElement(DBIcon, { size: 30, type: "edit" }));
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '30');
        expect(svg).toHaveAttribute('height', '30');
    });
    it('should now show tooltip if no text is passed', () => {
        render(React.createElement(DBIcon, { size: 30, type: "edit" }));
        expect(Tooltip).toHaveBeenCalledTimes(0);
    });
    it('should show tooltip if text is passed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DBIcon, { size: 30, type: "edit", tooltipText: "helper text" }));
        expect(Tooltip).toHaveBeenCalledTimes(1);
    }));
});
//# sourceMappingURL=DBIcon.test.js.map