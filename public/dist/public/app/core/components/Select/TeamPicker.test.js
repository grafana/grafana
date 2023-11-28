import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TeamPicker } from './TeamPicker';
jest.mock('@grafana/runtime', () => ({
    getBackendSrv: () => {
        return {
            get: () => {
                return Promise.resolve([]);
            },
        };
    },
}));
describe('TeamPicker', () => {
    it('renders correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = {
            onSelected: () => { },
        };
        render(React.createElement(TeamPicker, Object.assign({}, props)));
        expect(yield screen.findByTestId('teamPicker')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TeamPicker.test.js.map