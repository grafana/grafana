import { render } from '@testing-library/react';
import React from 'react';

import AccessRolesTable from './AccessRolesTable';

describe('AccessRolesTable', () => {
  it('renders empty message when no roles are provided', () => {
    render(<AccessRolesTable items={[]} />);
  });
});
