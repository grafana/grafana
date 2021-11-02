import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnconnectedReturnToDashboardButton as ReturnToDashboardButton } from './ReturnToDashboardButton';
import { ExploreId } from 'app/types/explore';
var createProps = function (propsOverride) {
    var defaultProps = {
        originPanelId: 1,
        splitted: false,
        canEdit: true,
        exploreId: ExploreId.left,
        queries: [],
        setDashboardQueriesToUpdateOnLoad: jest.fn(),
    };
    return Object.assign(defaultProps, propsOverride);
};
describe('ReturnToDashboardButton', function () {
    it('should render 2 buttons if originPanelId is provided', function () {
        render(React.createElement(ReturnToDashboardButton, __assign({}, createProps())));
        expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(2);
    });
    it('should not render any button if originPanelId is not provided', function () {
        render(React.createElement(ReturnToDashboardButton, __assign({}, createProps({ originPanelId: undefined }))));
        expect(screen.queryByTestId(/returnButton/i)).toBeNull();
    });
    it('should not render any button if split view', function () {
        render(React.createElement(ReturnToDashboardButton, __assign({}, createProps({ splitted: true }))));
        expect(screen.queryByTestId(/returnButton/i)).toBeNull();
    });
    it('should not render return to panel with changes button if user cannot edit panel', function () {
        render(React.createElement(ReturnToDashboardButton, __assign({}, createProps({ canEdit: false }))));
        expect(screen.getAllByTestId(/returnButton/i)).toHaveLength(1);
    });
    it('should show option to return to dashboard with changes', function () {
        render(React.createElement(ReturnToDashboardButton, __assign({}, createProps())));
        var returnWithChangesButton = screen.getByTestId('returnButtonWithChanges');
        returnWithChangesButton.click();
        expect(screen.getAllByText('Return to panel with changes')).toHaveLength(1);
    });
});
//# sourceMappingURL=ReturnToDashboardButton.test.js.map