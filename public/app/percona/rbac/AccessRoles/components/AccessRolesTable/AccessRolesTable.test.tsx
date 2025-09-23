import { render } from '@testing-library/react';

import AccessRolesTable from './AccessRolesTable';

describe('AccessRolesTable', () => {
  it('renders empty message when no roles are provided', () => {
    render(<AccessRolesTable items={[]} />);
  });
});
