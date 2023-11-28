import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { locationService } from '@grafana/runtime';
import { TestProvider } from '../../../../../test/helpers/TestProvider';
import { MegaMenu } from './MegaMenu';
const setup = () => {
    const navBarTree = [
        {
            text: 'Section name',
            id: 'section',
            url: 'section',
            children: [
                { text: 'Child1', id: 'child1', url: 'section/child1' },
                { text: 'Child2', id: 'child2', url: 'section/child2' },
            ],
        },
        {
            text: 'Profile',
            id: 'profile',
            url: 'profile',
        },
    ];
    const grafanaContext = getGrafanaContextMock();
    grafanaContext.chrome.setMegaMenu('open');
    return render(React.createElement(TestProvider, { storeState: { navBarTree }, grafanaContext: grafanaContext },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(MegaMenu, { onClose: () => { } }))));
};
describe('MegaMenu', () => {
    it('should render component', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByTestId('navbarmenu')).toBeInTheDocument();
        expect(yield screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
    }));
    it('should filter out profile', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=MegaMenu.test.js.map