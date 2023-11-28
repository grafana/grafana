import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
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
            defaultSubscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
        },
        azureCloudOptions: [
            { value: 'azuremonitor', label: 'Azure' },
            { value: 'govazuremonitor', label: 'Azure US Government' },
            { value: 'chinaazuremonitor', label: 'Azure China' },
        ],
        onCredentialsChange: jest.fn(),
        getSubscriptions: jest.fn().mockResolvedValue([]),
    };
    if (propsFunc) {
        props = propsFunc(props);
    }
    render(React.createElement(AzureCredentialsForm, Object.assign({}, props)));
};
describe('AzureCredentialsForm', () => {
    it('should render without error', () => {
        expect(() => setup()).not.toThrow();
    });
    it('should disable azure monitor secret input when the clientSecret is a symbol', () => __awaiter(void 0, void 0, void 0, function* () {
        setup((props) => (Object.assign(Object.assign({}, props), { credentials: Object.assign(Object.assign({}, props.credentials), { clientSecret: Symbol() }) })));
        expect(yield screen.findByLabelText('Client Secret')).toBeDisabled();
    }));
    it('should enable azure monitor load subscriptions button when all required fields are defined', () => __awaiter(void 0, void 0, void 0, function* () {
        setup((props) => (Object.assign(Object.assign({}, props), { credentials: Object.assign(Object.assign({}, props.credentials), { clientSecret: 'e7f3f661-a933-4b3f-8176-51c4f982ec48' }) })));
        expect(yield screen.findByRole('button', { name: 'Load Subscriptions' })).not.toBeDisabled();
    }));
});
//# sourceMappingURL=AzureCredentialsForm.test.js.map