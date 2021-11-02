import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TeamPicker } from './TeamPicker';
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () {
        return {
            get: function () {
                return Promise.resolve([]);
            },
        };
    },
}); });
describe('TeamPicker', function () {
    it('renders correctly', function () {
        var props = {
            onSelected: function () { },
        };
        render(React.createElement(TeamPicker, __assign({}, props)));
        expect(screen.getByTestId('teamPicker')).toBeInTheDocument();
    });
});
//# sourceMappingURL=TeamPicker.test.js.map