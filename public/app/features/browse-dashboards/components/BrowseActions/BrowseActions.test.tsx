import { render, screen } from '@testing-library/react';
import React from 'react';

import { BrowseActions } from './BrowseActions';

describe('browse-dashboards BrowseActions', () => {
  it('displays Move and Delete buttons', () => {
    render(<BrowseActions />);

    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
