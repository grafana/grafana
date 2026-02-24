import { render, screen } from '@testing-library/react';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

describe('MissingFolderMetadataBanner', () => {
  it('renders warning alert with correct content', () => {
    render(<MissingFolderMetadataBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata file in repository.')).toBeInTheDocument();
    expect(screen.getByText('Permissions may not persist if the folder is moved or renamed.')).toBeInTheDocument();
  });
});
