import { __awaiter } from "tslib";
import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../../../store/configureStore';
import { Restore } from './Restore';
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
jest.mock('app/percona/dbaas/components/DBCluster/EditDBClusterPage/DBaaSBackups/DBaaSBackups.service');
const store = configureStore({
    percona: {
        user: { isAuthorized: true },
        kubernetes: {
            loading: false,
        },
    },
});
describe('DBaaS DBCluster creation Restore section ::', () => {
    it('renders items correctly, shows fields on switch on', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: store },
            React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => React.createElement(Restore, { form: form }) }))));
        expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
        const checkbox = screen.getByTestId('toggle-scheduled-restore');
        fireEvent.click(checkbox);
        expect(screen.getByTestId('locations-select-wrapper')).toBeInTheDocument();
    }));
    it('shows backup artifacts field when location field is not empty', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: store },
            React.createElement(Form, { onSubmit: jest.fn(), initialValues: {
                    restoreFrom: {
                        label: 'location1',
                        value: 'location1',
                    },
                }, render: ({ form }) => {
                    return React.createElement(Restore, { form: form });
                } }))));
        expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
        const checkbox = screen.getByTestId('toggle-scheduled-restore');
        yield waitFor(() => fireEvent.click(checkbox));
        expect(screen.getByTestId('backupArtifact-field-container')).toBeInTheDocument();
    }));
    it('shows secrets field if kubernetesCluster name exists in form', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: store },
            React.createElement(Form, { onSubmit: jest.fn(), initialValues: {
                    kubernetesCluster: {
                        label: 'cluster 1',
                        value: 'cluster 1',
                    },
                }, render: ({ form }) => {
                    return React.createElement(Restore, { form: form });
                } }))));
        expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
        const checkbox = screen.getByTestId('toggle-scheduled-restore');
        yield waitFor(() => fireEvent.click(checkbox));
        expect(screen.getByTestId('secretsName-field-container')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=Restore.test.js.map