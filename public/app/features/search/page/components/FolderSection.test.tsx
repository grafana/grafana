import { render, screen } from '@testing-library/react';
import React from 'react';

import { FolderSection } from './FolderSection';

describe('FolderSection', () => {
  const mockOnTagSelected = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSection = {
    kind: 'folder',
    uid: 'uid',
    title: 'title',
  };

  it('renders a loading spinner whilst the data is being retrieved', async () => {
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
    console.log(screen.debug());
    expect(await screen.findByTestId('loading-spinner')).toBeInTheDocument();
    console.log(screen.debug());
  });
});
