import { __assign } from "tslib";
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertRuleItem from './AlertRuleItem';
var setup = function (propOverrides) {
    var props = {
        rule: {
            id: 1,
            dashboardId: 1,
            panelId: 1,
            name: 'Some rule',
            state: 'Open',
            stateText: 'state text',
            stateIcon: 'icon',
            stateClass: 'state class',
            stateAge: 'age',
            url: 'https://something.something.darkside',
        },
        search: '',
        onTogglePause: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(AlertRuleItem, __assign({}, props)));
};
describe('AlertRuleItem', function () {
    it('should render component', function () {
        var mockToggle = jest.fn();
        setup({ onTogglePause: mockToggle });
        expect(screen.getByText('Some rule')).toBeInTheDocument();
        expect(screen.getByText('state text')).toBeInTheDocument();
        expect(screen.getByText('Pause')).toBeInTheDocument();
        expect(screen.getByText('Edit alert')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Pause'));
        expect(mockToggle).toHaveBeenCalled();
    });
});
//# sourceMappingURL=AlertRuleItem.test.js.map