import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';

import { MoveToFolderModal } from './MoveToFolderModal';

jest.mock('app/core/components/Select/FolderPicker', () => {
  return {
    FolderPicker: () => null,
  };
});

describe('MoveToFolderModal', () => {
  it('should render correct title, body, dismiss-, cancel- and move-text', async () => {
    const items = new Map();
    const dashboardsUIDs = new Set();
    dashboardsUIDs.add('uid1');
    dashboardsUIDs.add('uid2');
    items.set('dashboard', dashboardsUIDs);
    const isMoveModalOpen = true;
    const mockStore = configureMockStore();
    const store = mockStore({ dashboard: { panels: [] } });
    const onMoveItems = jest.fn();

    render(
      <Provider store={store}>
        <MoveToFolderModal onMoveItems={onMoveItems} results={items} isOpen={isMoveModalOpen} onDismiss={() => {}} />
      </Provider>
    );

    expect(screen.getByRole('heading', { name: 'Choose Dashboard Folder' })).toBeInTheDocument();
    expect(screen.getByText('Move the 2 selected dashboards to the following folder:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
  });
});
