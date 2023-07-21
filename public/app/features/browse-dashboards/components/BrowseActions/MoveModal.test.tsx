import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/__mocks__/backend_srv';
import * as api from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from 'app/features/search/types';

import { MoveModal, Props } from './MoveModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('browse-dashboards MoveModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockFolders = [
    { title: 'General', uid: '' } as DashboardSearchHit,
    { title: 'Folder 1', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
  ];
  let props: Props;

  beforeAll(() => {
    setBackendSrv(backendSrv);
    jest.spyOn(backendSrv, 'get').mockResolvedValue({
      dashboard: 0,
      folder: 0,
    });
  });

  beforeEach(() => {
    props = {
      isOpen: true,
      onConfirm: mockOnConfirm,
      onDismiss: mockOnDismiss,
      selectedItems: {
        $all: false,
        folder: {},
        dashboard: {},
        panel: {},
      },
    };

    // mock the searchFolders api call so the folder picker has some folders in it
    jest.spyOn(api, 'searchFolders').mockResolvedValue(mockFolders);
  });

  it('renders a dialog with the correct title', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('dialog', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Move` button', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeInTheDocument();
  });

  it('displays a `Cancel` button', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('displays a folder picker', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('combobox', { name: 'Select a folder' })).toBeInTheDocument();
  });

  it('displays a warning about permissions if a folder is selected', async () => {
    props.selectedItems.folder = {
      myFolderUid: true,
    };
    render(<MoveModal {...props} />);

    expect(
      await screen.findByRole('status', { name: 'Moving this item may change its permissions.' })
    ).toBeInTheDocument();
  });

  it('only enables the `Move` button if a folder is selected', async () => {
    render(<MoveModal {...props} />);

    expect(await screen.findByRole('button', { name: 'Move' })).toBeDisabled();
    const folderPicker = await screen.findByRole('combobox', { name: 'Select a folder' });

    await selectOptionInTest(folderPicker, mockFolders[1].title);
    expect(await screen.findByRole('button', { name: 'Move' })).toBeEnabled();
  });

  it('calls onConfirm when clicking the `Move` button', async () => {
    render(<MoveModal {...props} />);
    const folderPicker = await screen.findByRole('combobox', { name: 'Select a folder' });

    await selectOptionInTest(folderPicker, mockFolders[1].title);
    await userEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect(mockOnConfirm).toHaveBeenCalledWith(mockFolders[1].uid);
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    render(<MoveModal {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    render(<MoveModal {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
