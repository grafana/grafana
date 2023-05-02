import { render as rtlRender, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { BrowseActions } from './BrowseActions';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('browse-dashboards BrowseActions', () => {
  it('displays Move and Delete buttons', () => {
    render(<BrowseActions />);

    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
