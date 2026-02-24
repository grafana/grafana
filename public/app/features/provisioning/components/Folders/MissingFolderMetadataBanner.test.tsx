import { render, screen } from '@testing-library/react';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

describe('MissingFolderMetadataBanner', () => {
  it('renders warning alert with correct content', () => {
    render(<MissingFolderMetadataBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
    expect(screen.getByText('If you move or rename it in Git, permissions may not persist.')).toBeInTheDocument();
  });
});
