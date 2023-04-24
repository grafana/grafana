import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import * as api from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from 'app/features/search/types';

import { MoveModal, Props } from './MoveModal';

describe('browse-dashboards MoveModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps: Props = {
    isOpen: true,
    onConfirm: mockOnConfirm,
    onDismiss: mockOnDismiss,
    selectedItems: {
      folder: {},
      dashboard: {},
      panel: {},
    },
  };

  beforeEach(() => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'General', uid: '' } as DashboardSearchHit,
        { title: 'Folder 1', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);
  });

  it('renders a dialog with the correct title', async () => {
    render(<MoveModal {...defaultProps} />);

    expect(await screen.findByRole('dialog', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Move` button', async () => {
    render(<MoveModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Cancel` button', async () => {
    render(<MoveModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('displays a folder picker', async () => {
    render(<MoveModal {...defaultProps} />);

    expect(await screen.findByRole('combobox', { name: 'Select a folder' })).toBeInTheDocument();
  });

  it('displays a warning about permissions if a folder is selected', async () => {
    const props = {
      ...defaultProps,
    };
    props.selectedItems.folder = {
      myFolderUid: true,
    };
    render(<MoveModal {...props} />);

    expect(await screen.findByText('Moving this item may change its permissions.')).toBeInTheDocument();
  });

  it('only enables the `Move` button if a folder is selected', async () => {
    render(<MoveModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeDisabled();
    const folderPicker = await screen.findByRole('combobox', { name: 'Select a folder' });

    await selectOptionInTest(folderPicker, 'Folder 1');
    expect(await screen.findByRole('button', { name: 'Move' })).toBeEnabled();
  });

  it('calls onConfirm when clicking the `Move` button', async () => {
    render(<MoveModal {...defaultProps} />);
    const folderPicker = await screen.findByRole('combobox', { name: 'Select a folder' });

    await selectOptionInTest(folderPicker, 'Folder 1');
    await userEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect(mockOnConfirm).toHaveBeenCalledWith('wfTJJL5Wz');
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    render(<MoveModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    render(<MoveModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close dialog' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
