import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import AzureCredentialsForm from './AzureCredentialsForm';
const setup = (propsFunc) => {
    let props = {
        managedIdentityEnabled: false,
        workloadIdentityEnabled: false,
        credentials: {
            authType: 'clientsecret',
            azureCloud: 'azuremonitor',
            tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
            clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
            clientSecret: undefined,
        },
        azureCloudOptions: [
            { value: 'azuremonitor', label: 'Azure' },
            { value: 'govazuremonitor', label: 'Azure US Government' },
            { value: 'chinaazuremonitor', label: 'Azure China' },
        ],
        onCredentialsChange: jest.fn(),
    };
    if (propsFunc) {
        props = propsFunc(props);
    }
    return render(React.createElement(AzureCredentialsForm, Object.assign({}, props)));
};
describe('Render', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByText('Azure Cloud')).toBeInTheDocument();
    });
    it('should disable azure monitor secret input', () => __awaiter(void 0, void 0, void 0, function* () {
        setup((props) => (Object.assign(Object.assign({}, props), { credentials: {
                authType: 'clientsecret',
                azureCloud: 'azuremonitor',
                tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
                clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
                clientSecret: Symbol(),
            } })));
        yield waitFor(() => screen.getByTestId('client-secret'));
        expect(screen.getByTestId('client-secret')).toBeDisabled();
    }));
    describe('when disabled', () => {
        it('should disable inputs', () => __awaiter(void 0, void 0, void 0, function* () {
            setup((props) => (Object.assign(Object.assign({}, props), { disabled: true })));
            yield waitFor(() => screen.getByLabelText('Azure Cloud'));
            expect(screen.getByLabelText('Azure Cloud')).toBeDisabled();
        }));
    });
});
//# sourceMappingURL=AzureCredentialsForm.test.js.map