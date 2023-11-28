import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime/src';
import { configureStore } from '../../../../../store/configureStore';
import { EditK8sClusterPage } from './EditK8sClusterPage';
describe('EditK8sClusterPage::', () => {
    it('renders the form with all elements', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { publicAddress: 'localhost', dbaasEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(EditK8sClusterPage, null))));
        expect(screen.getByTestId('name-text-input')).toBeInTheDocument();
        expect(screen.getByTestId('kubeConfig-textarea-input')).toBeInTheDocument();
        expect(screen.getAllByTestId('isEKS-radio-button')).toHaveLength(2);
        expect(screen.getByTestId('eks-info-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('pmm-server-url-warning')).toBeFalsy();
        expect(screen.queryByTestId('kubernetes-paste-from-clipboard-button')).toBeInTheDocument();
    });
    it('shows PMM Server Url Warning', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { publicAddress: '', dbaasEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(EditK8sClusterPage, null))));
        expect(yield screen.findByTestId('pmm-server-url-warning')).toBeInTheDocument();
    }));
    it('clicking isEKS radio shows AWS credentials fields', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { publicAddress: 'localhost', dbaasEnabled: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(EditK8sClusterPage, null))));
        expect(screen.queryByTestId('awsAccessKeyID-text-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('awsSecretAccessKey-password-input')).not.toBeInTheDocument();
        const showEKSRadio = screen.getAllByTestId('isEKS-radio-button')[1];
        fireEvent.click(showEKSRadio);
        expect(screen.queryByTestId('awsAccessKeyID-text-input')).toBeInTheDocument();
        expect(screen.queryByTestId('awsSecretAccessKey-password-input')).toBeInTheDocument();
    });
});
//# sourceMappingURL=EditK8sClusterPage.test.js.map