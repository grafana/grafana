import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Props, TeamSettings } from './TeamSettings';
import { getMockTeam } from './__mocks__/teamMocks';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermissionInMetadata: () => true,
  },
}));

jest.mock('app/core/components/SharedPreferences/SharedPreferences', () => {
  return { SharedPreferences: () => <div /> };
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    team: getMockTeam(),
    updateTeam: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<TeamSettings {...props} />);
};

describe('Team settings', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByText('Team settings')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const mockUpdate = jest.fn();
    setup({ updateTeam: mockUpdate });
    await userEvent.clear(screen.getByRole('textbox', { name: /Name/ }));
    await userEvent.type(screen.getByLabelText(/Email/i), 'team@test.com');
    // Submitting with userEvent doesn't work here
    fireEvent.submit(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    await waitFor(() => expect(mockUpdate).not.toHaveBeenCalled());
  });

  it('should submit form with correct values', async () => {
    const mockUpdate = jest.fn();
    setup({ updateTeam: mockUpdate });
    await userEvent.clear(screen.getByRole('textbox', { name: /Name/ }));
    await userEvent.clear(screen.getByLabelText(/Email/i));
    await userEvent.type(screen.getByRole('textbox', { name: /Name/ }), 'New team');
    await userEvent.type(screen.getByLabelText(/Email/i), 'team@test.com');
    // Submitting with userEvent doesn't work here
    fireEvent.submit(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('New team', 'team@test.com'));
  });
});
