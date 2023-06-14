import { render, screen } from '@testing-library/react';
import React from 'react';

import { config } from 'app/core/config';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';

describe('ConfirmModal', () => {
  it('should render correct title, body, dismiss-, cancel- and delete-text', () => {
    const selectedItems = new Map([['dashboard', new Set(['uid1', 'uid2'])]]);

    render(<ConfirmDeleteModal onDeleteItems={() => {}} results={selectedItems} onDismiss={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByText('Do you want to delete the 2 selected dashboards?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    expect(screen.queryByPlaceholderText('Type "delete" to confirm')).not.toBeInTheDocument();
  });

  describe('with nestedFolders feature flag', () => {
    let originalNestedFoldersValue = config.featureToggles.nestedFolders;

    beforeAll(() => {
      originalNestedFoldersValue = config.featureToggles.nestedFolders;
      config.featureToggles.nestedFolders = true;
    });

    afterAll(() => {
      config.featureToggles.nestedFolders = originalNestedFoldersValue;
    });

    it("should ask to type 'delete' to confirm when a folder is selected", async () => {
      const selectedItems = new Map([
        ['dashboard', new Set(['uid1', 'uid2'])],
        ['folder', new Set(['uid3'])],
      ]);

      render(<ConfirmDeleteModal onDeleteItems={() => {}} results={selectedItems} onDismiss={() => {}} />);

      expect(screen.getByPlaceholderText('Type "delete" to confirm')).toBeInTheDocument();
    });
  });
});
