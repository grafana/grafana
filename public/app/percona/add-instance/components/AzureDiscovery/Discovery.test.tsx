import { render, screen } from '@testing-library/react';
import React from 'react';

import Discovery from './Discovery';

jest.mock('app/percona/add-instance/components/Discovery/Discovery.service');

describe('Discovery instance:: ', () => {
  it('Should render correct', () => {
    const selectInstance = jest.fn();

    render(<Discovery onSubmit={jest.fn()} selectInstance={selectInstance} />);
    expect(screen.getByTestId('azure_client_id-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_client_secret-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_tenant_id-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('azure_subscription_id-text-input')).toBeInTheDocument();
  });
});
