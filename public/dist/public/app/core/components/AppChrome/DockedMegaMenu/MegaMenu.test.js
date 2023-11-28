import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
                {
                    text: 'Child1',
                    id: 'child1',
                    url: 'section/child1',
                    children: [{ text: 'Grandchild1', id: 'grandchild1', url: 'section/child1/grandchild1' }],
                },
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
    afterEach(() => {
        window.localStorage.clear();
    });
    it('should render component', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByTestId('navbarmenu')).toBeInTheDocument();
        expect(yield screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
    }));
    it('should render children', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Expand section Section name' }));
        expect(yield screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
        expect(yield screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
    }));
    it('should render grandchildren', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Expand section Section name' }));
        expect(yield screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Expand section Child1' }));
        expect(yield screen.findByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
        expect(yield screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
    }));
    it('should filter out profile', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=MegaMenu.test.js.map