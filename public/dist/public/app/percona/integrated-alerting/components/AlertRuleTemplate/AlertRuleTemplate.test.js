import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { AlertRuleTemplate } from './AlertRuleTemplate';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
jest.mock('./AlertRuleTemplate.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('AlertRuleTemplate', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should render add modal', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(AlertRuleTemplate, null))));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.queryByTestId('modal-wrapper')).not.toBeInTheDocument();
        const button = screen.getByTestId('alert-rule-template-add-modal-button');
        fireEvent.click(button);
        expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
    }));
    it('should render table content', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(AlertRuleTemplate, null))));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
        expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(5);
        expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
    }));
    it('should render correctly without data', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() => {
            throw Error('test error');
        });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(AlertRuleTemplate, null))));
        expect(screen.queryByTestId('table-thead')).not.toBeInTheDocument();
        expect(screen.queryByTestId('table-tbody')).not.toBeInTheDocument();
        expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AlertRuleTemplate.test.js.map