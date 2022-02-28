import { render, screen } from '@testing-library/react';
import React from 'react';
import Discovery from './Discovery';

describe('Discovery instance:: ', () => {
  it('Should render correct', () => {
    const selectInstance = jest.fn();

    render(<Discovery selectInstance={selectInstance} />);
    expect(screen.getByTestId('azure_client_id-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_client_secret-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_tenant_id-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_subscription_id-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('credentials-search-button')).toBeInTheDocument();
  });
});
