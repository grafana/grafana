import { render } from '@testing-library/react';
import React from 'react';

import { LdapConnectionStatus } from './LdapConnectionStatus';

describe('LdapConnectionStatus', () => {
  it('renders the component', () => {
    const ldapConnectionInfo = [
      { host: 'example.com', port: 389, available: true, error: '' },
      { host: 'localhost', port: 636, available: false, error: 'Connection failed' },
    ];

    const { getByText } = render(<LdapConnectionStatus ldapConnectionInfo={ldapConnectionInfo} />);

    expect(getByText('LDAP Connection')).toBeInTheDocument();
    expect(getByText('example.com')).toBeInTheDocument();
    expect(getByText('localhost')).toBeInTheDocument();
    expect(getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders the component with no server info', () => {
    const { queryByText } = render(<LdapConnectionStatus ldapConnectionInfo={[]} />);
    expect(queryByText('LDAP Connection')).toBeInTheDocument();
  });
});
