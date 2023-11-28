import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Databases } from '../../../../../../shared/core';
import { Messages } from '../DBClusterAdvancedOptions.messages';
import Configurations from './Configurations';
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
describe('DBClusterAdvancedOptions Configurations::', () => {
    it('renders items correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => (React.createElement(Configurations, { databaseType: Databases.haproxy, k8sClusterName: 'testName', mode: 'create', form: form })) })));
        expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(Messages.fieldSets.commonConfiguration);
        expect(screen.getByTestId('storageClass-field-label')).toHaveTextContent(Messages.labels.storageClass);
        expect(screen.getByTestId('storageClass-field-container').querySelector('input')).toBeTruthy();
        expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.commonConfiguration);
        expect(screen.getByTestId('configuration-textarea-input')).toBeInTheDocument();
    }));
    it('shows labels correctly for pxc', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => (React.createElement(Configurations, { databaseType: Databases.mysql, k8sClusterName: 'testName', mode: 'create', form: form })) })));
        expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(Messages.fieldSets.pxcConfiguration);
        expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.pxcConfiguration);
    }));
    it('shows labels correctly for mongoDB', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => (React.createElement(Configurations, { databaseType: Databases.mongodb, k8sClusterName: 'testName', mode: 'create', form: form })) })));
        expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(Messages.fieldSets.mongodbConfiguration);
        expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.mongodbConfiguration);
    }));
    it('storageClass is disabled for edit mode', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Form, { onSubmit: jest.fn(), render: ({ form }) => (React.createElement(Configurations, { databaseType: Databases.mongodb, k8sClusterName: 'testName', mode: 'edit', form: form })) })));
        expect(screen.getByTestId('storageClass-field-container').querySelector('input')).toBeDisabled();
    }));
});
//# sourceMappingURL=Configurations.test.js.map