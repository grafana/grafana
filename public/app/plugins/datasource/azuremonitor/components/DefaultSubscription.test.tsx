import { render, screen } from '@testing-library/react';
import React from 'react';

import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import { selectors } from '../e2e/selectors';

import { DefaultSubscription, Props } from './DefaultSubscription';

const mockInstanceSettings = createMockInstanceSetttings();

const defaultProps: Props = {
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
    render(<DefaultSubscription {...defaultProps} />);

    expect(screen.getByText('Default Subscription')).toBeInTheDocument();
  });

  it('should disable load subscriptions if credentials are incomplete', () => {
    render(<DefaultSubscription {...{ ...defaultProps, credentials: { authType: 'clientsecret' } }} />);

    expect(screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button)).toBeDisabled();
  });

  it('should enable load subscriptions if credentials are complete and set default subscription', () => {
    const props = {
      ...defaultProps,
      credentials: { ...defaultProps.credentials, clientSecret: 'client_secret' },
      options: { ...defaultProps.options, subscriptionId: undefined },
    };
    const { rerender } = render(<DefaultSubscription {...props} />);

    expect(screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button)).not.toBeDisabled();
    screen.getByTestId(selectors.components.configEditor.loadSubscriptions.button).click();
    rerender(
      <DefaultSubscription
        {...props}
        subscriptions={[{ label: 'subscriptionId', value: 'subscriptionId' }]}
        options={{ ...defaultProps.options, subscriptionId: 'subscriptionId' }}
      />
    );
    expect(document.body).toHaveTextContent('subscriptionId');
  });
});
