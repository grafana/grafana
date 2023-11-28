import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import { selectors } from '../e2e/selectors';
import { DefaultSubscription } from './DefaultSubscription';
const mockInstanceSettings = createMockInstanceSetttings();
const defaultProps = {
    options: mockInstanceSettings.jsonData,
    credentials: {
        authType: 'clientsecret',
        azureCloud: 'azuremonitor',
        tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
        clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
        clientSecret: undefined,
    },
    subscriptions: [],
    getSubscriptions: jest.fn().mockResolvedValue([{ label: 'subscriptionId', value: 'subscriptionId' }]),
    onSubscriptionsChange: jest.fn(),
    onSubscriptionChange: jest.fn(),
};
describe('DefaultSubscription', () => {
    it('should render component', () => {
        render(React.createElement(DefaultSubscription, Object.assign({}, defaultProps)));
        expect(screen.getByText('Default Subscription')).toBeInTheDocument();
    });
    it('should disable load subscriptions if credentials are incomplete', () => {
        render(React.createElement(DefaultSubscription, Object.assign({}, Object.assign(Object.assign({}, defaultProps), { credentials: { authType: 'clientsecret' } }))));
        expect(screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button)).toBeDisabled();
    });
    it('should enable load subscriptions if credentials are complete and set default subscription', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = Object.assign(Object.assign({}, defaultProps), { credentials: Object.assign(Object.assign({}, defaultProps.credentials), { clientSecret: 'client_secret' }), options: Object.assign(Object.assign({}, defaultProps.options), { subscriptionId: undefined }) });
        const { rerender } = render(React.createElement(DefaultSubscription, Object.assign({}, props)));
        expect(screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button)).not.toBeDisabled();
        yield userEvent.click(screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button));
        rerender(React.createElement(DefaultSubscription, Object.assign({}, props, { subscriptions: [{ label: 'subscriptionId', value: 'subscriptionId' }], options: Object.assign(Object.assign({}, defaultProps.options), { subscriptionId: 'subscriptionId' }) })));
        expect(document.body).toHaveTextContent('subscriptionId');
    }));
});
//# sourceMappingURL=DefaultSubscription.test.js.map