import { render, screen } from '@testing-library/react';
import React from 'react';

import { UserPicker } from './UserPicker';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]) }),
}));

describe('UserPicker', () => {
  it('renders correctly', async () => {
    render(<UserPicker onSelected={() => {}} />);

    expect(await screen.findByTestId('userPicker')).toBeInTheDocument();
  });
});
