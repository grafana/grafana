import { render, screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { Account } from './Account';

export const AccountOptions = [
  {
    value: '123456789',
    label: 'test-account1',
    description: '123456789',
  },
  {
    value: '432156789013',
    label: 'test-account2',
    description: '432156789013',
  },
  {
    value: '999999999999',
    label: 'test-account3',
    description: '999999999999',
  },
  {
    label: 'Template Variables',
    options: [
      {
        value: '$fakeVar',
        label: '$fakeVar',
      },
    ],
  },
];
describe('Account', () => {
  const props = {
    accountOptions: AccountOptions,
    region: 'us-east-2',
    onChange: jest.fn(),
    accountId: '123456789012',
  };

  it('should not render if there are no accounts', async () => {
    render(<Account {...props} accountOptions={[]} />);
    expect(screen.queryByLabelText('Account Selection')).not.toBeInTheDocument();
  });

  it('should render a selectable field of accounts if there are accounts', async () => {
    const onChange = jest.fn();
    render(<Account {...props} onChange={onChange} />);
    expect(screen.getByLabelText('Account Selection')).toBeInTheDocument();
    await selectEvent.select(screen.getByLabelText('Account Selection'), 'test-account3', { container: document.body });
    expect(onChange).toBeCalledWith('999999999999');
  });

  it("should default to 'all' if there is no selection", () => {
    render(<Account {...props} accountId={undefined} />);
    expect(screen.getByLabelText('Account Selection')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should select an uninterpolated template variable if it has been selected', () => {
    render(<Account {...props} accountId={'$fakeVar'} />);
    expect(screen.getByLabelText('Account Selection')).toBeInTheDocument();
    expect(screen.getByText('$fakeVar')).toBeInTheDocument();
  });
});
