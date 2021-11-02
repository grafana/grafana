import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AddPanelWidgetUnconnected as AddPanelWidget } from './AddPanelWidget';
var getTestContext = function (propOverrides) {
    var props = {
        dashboard: {},
        panel: {},
        addPanel: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(AddPanelWidget, __assign({}, props)));
};
describe('AddPanelWidget', function () {
    it('should render component without error', function () {
        expect(function () {
            getTestContext();
        });
    });
    it('should render the add panel actions', function () {
        getTestContext();
        expect(screen.getByText(/Add an empty panel/i)).toBeInTheDocument();
        expect(screen.getByText(/Add a new row/i)).toBeInTheDocument();
        expect(screen.getByText(/Add a panel from the panel library/i)).toBeInTheDocument();
    });
});
//# sourceMappingURL=AddPanelWidget.test.js.map