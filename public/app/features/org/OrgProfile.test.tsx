import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import OrgProfile, { Props } from './OrgProfile';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
  };
});

describe('OrgProfile', () => {
  const props: Props = {
    orgName: 'Main org',
    onSubmit: jest.fn(),
  };

  it('should render without crashing', () => {
    expect(() => render(<OrgProfile {...props} />)).not.toThrow();
  });

  it('should show the current org name', () => {
    render(<OrgProfile {...props} />);

    const orgNameInput = screen.getByLabelText('Organization name');

    expect(orgNameInput).toHaveValue('Main org');
  });

  it('can update the current org name', async () => {
    render(<OrgProfile {...props} />);

    const orgNameInput = screen.getByLabelText('Organization name');
    const submitButton = screen.getByRole('button', { name: 'Update organization name' });

    expect(orgNameInput).toHaveValue('Main org');

    await userEvent.clear(orgNameInput);
    await userEvent.type(orgNameInput, 'New org name');
    await userEvent.click(submitButton);

    expect(props.onSubmit).toHaveBeenCalledWith('New org name');
  });
});
