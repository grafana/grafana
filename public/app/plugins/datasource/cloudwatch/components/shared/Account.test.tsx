import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

import { selectOptionInTest } from '../../utils/testUtils';

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
    expect(screen.queryByRole('combobox', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('should render a selectable field of accounts if there are accounts', async () => {
    const onChange = jest.fn();
    render(<Account {...props} onChange={onChange} />);
    await selectOptionInTest(screen.getByRole('combobox', { name: 'Account' }), 'test-account3');
    expect(onChange).toBeCalledWith('999999999999');
  });

  it("should default to 'all' if there is no selection", () => {
    render(<Account {...props} accountId={undefined} />);
    expect(screen.queryByRole('combobox', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should select an uninterpolated template variable if it has been selected', () => {
    render(<Account {...props} accountId={'$fakeVar'} />);
    expect(screen.queryByRole('combobox', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText('$fakeVar')).toBeInTheDocument();
  });
});
