import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';

describe('ConfirmModal', () => {
  it('should render correct title, body, dismiss-, cancel- and delete-text', () => {
    const items = new Map();
    const dashboardsUIDs = new Set();
    dashboardsUIDs.add('uid1');
    dashboardsUIDs.add('uid2');
    items.set('dashboard', dashboardsUIDs);
    const isDeleteModalOpen = true;
    const onDeleteItems = jest.fn();
    render(
      <ConfirmDeleteModal
        onDeleteItems={onDeleteItems}
        results={items}
        isOpen={isDeleteModalOpen}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByText('Do you want to delete the 2 selected dashboards?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Confirm Modal Danger Button' });
    expect(within(button).getByText('Delete')).toBeInTheDocument();
  });
});
