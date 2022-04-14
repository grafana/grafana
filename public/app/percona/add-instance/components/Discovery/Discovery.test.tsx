import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import Discovery from './Discovery';

describe('Discovery:: ', () => {
  it('should render credentials, instances and docs', async () => {
    await waitFor(() => render(<Discovery selectInstance={jest.fn()} />));

    expect(screen.getByTestId('credentials-form')).toBeInTheDocument();
    expect(screen.getByTestId('instances-table-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('discovery-docs')).toBeInTheDocument();
  });
});
