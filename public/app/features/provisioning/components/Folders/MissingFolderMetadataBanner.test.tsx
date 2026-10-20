import { render, screen } from 'test/test-utils';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

jest.mock('./FixFolderMetadataDrawer', () => ({
  FixFolderMetadataDrawer: ({ repositoryName, onDismiss }: { repositoryName: string; onDismiss: () => void }) => (
    <div data-testid="fix-folder-metadata-drawer" data-repo={repositoryName}>
      <button onClick={onDismiss}>Close</button>
    </div>
  ),
}));

describe('MissingFolderMetadataBanner', () => {
  it('renders warning alert with correct content', () => {
    render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Since this folder doesn't contain a metadata file, the folder ID is based on the folder path. If you move or rename the folder, the folder ID will change, and permissions may no longer apply to the folder."
      )
    ).toBeInTheDocument();
  });

  it('renders fix button', () => {
    render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    expect(screen.getByText('Fix folder IDs')).toBeInTheDocument();
  });

  it('opens drawer when fix button is clicked', async () => {
    const { user } = render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    expect(screen.queryByTestId('fix-folder-metadata-drawer')).not.toBeInTheDocument();

    await user.click(screen.getByText('Fix folder IDs'));

    const drawer = screen.getByTestId('fix-folder-metadata-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute('data-repo', 'test-repo');
  });

  it('closes drawer when onDismiss is called', async () => {
    const { user } = render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    await user.click(screen.getByText('Fix folder IDs'));
    expect(screen.getByTestId('fix-folder-metadata-drawer')).toBeInTheDocument();

    await user.click(screen.getByText('Close'));
    expect(screen.queryByTestId('fix-folder-metadata-drawer')).not.toBeInTheDocument();
  });
});
