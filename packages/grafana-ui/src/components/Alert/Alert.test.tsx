import { render, screen } from '@testing-library/react';
import React from 'react';

import { Alert } from './Alert';

describe('Alert', () => {
  it('sets the accessible label correctly based on the title', () => {
    render(<Alert title="Uh oh spagghettios!" />);
    expect(screen.getByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
  });
});
