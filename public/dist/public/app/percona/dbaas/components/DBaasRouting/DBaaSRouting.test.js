import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime/src';
import { configureStore } from '../../../../store/configureStore';
import { K8S_INVENTORY_URL } from '../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';
import { KubernetesClusterStatus } from '../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import DBaaSRouting from './DBaaSRouting';
describe('SwitchField::', () => {
    it('should show loading when we are waiting kubernetes response', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                    kubernetes: {
                        loading: true,
                    },
                },
            }) },
            React.createElement(DBaaSRouting, null)));
        expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });
    it('should return redirect to /dbclusters  if we have one or more kubernetes clusters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                        result: [
                            {
                                kubernetesClusterName: 'cluster1',
                                status: KubernetesClusterStatus.ok,
                                operators: {
                                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                                },
                            },
                        ],
                    },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(DBaaSRouting, null))));
        expect(locationService.getLocation().pathname).toBe('/dbaas/dbclusters');
    }));
    it('should return redirect to /kubernetes  if we have no kubernetes clusters', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { dbaasEnabled: true } },
                    kubernetes: {
                        loading: false,
                        result: {},
                    },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(DBaaSRouting, null)))));
        expect(locationService.getLocation().pathname).toBe(K8S_INVENTORY_URL);
    }));
});
//# sourceMappingURL=DBaaSRouting.test.js.map