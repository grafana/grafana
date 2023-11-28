import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { defaultDashboard } from '@grafana/schema';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import AddPanelButton from './AddPanelButton';
jest.mock('./AddPanelMenu', () => (Object.assign(Object.assign({}, jest.requireActual('./AddPanelMenu')), { __esModule: true, default: () => React.createElement("div", null, "Menu") })));
function setup(options) {
    const props = {
        dashboard: createDashboardModelFixture(defaultDashboard),
    };
    const { rerender } = render(React.createElement(AddPanelButton, { dashboard: props.dashboard }));
    return rerender;
}
beforeEach(() => {
    jest.clearAllMocks();
});
it('renders button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
});
it('renders button without menu when menu is not open', () => {
    setup();
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
});
it('renders button with menu when menu is open', () => __awaiter(void 0, void 0, void 0, function* () {
    const user = userEvent.setup();
    setup();
    yield user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByText('Menu')).toBeInTheDocument();
}));
//# sourceMappingURL=AddPanelButton.test.js.map