import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { byTestId } from 'testing-library-selector';

import { SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

import { FolderInfo, PermissionLevelString } from '../../../../types';

import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker, ReadonlyFolderPickerProps } from './ReadonlyFolderPicker';
import * as api from './api';

const FOLDERS = [
  { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
  { value: { id: 1, title: 'Test' }, label: 'Test' },
];

async function getTestContext(
  propOverrides: Partial<ReadonlyFolderPickerProps> = {},
  folders: Array<SelectableValue<FolderInfo>> = [],
  folder: SelectableValue<FolderInfo> | undefined = undefined
) {
  jest.clearAllMocks();
  const selectors = {
    container: byTestId(e2eSelectors.components.ReadonlyFolderPicker.container),
  };
  const getFoldersAsOptionsSpy = jest.spyOn(api, 'getFoldersAsOptions').mockResolvedValue(folders);
  const getFolderAsOptionSpy = jest.spyOn(api, 'getFolderAsOption').mockResolvedValue(folder);
  const props: ReadonlyFolderPickerProps = {
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<ReadonlyFolderPicker {...props} />);
  await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());

  return { getFoldersAsOptionsSpy, getFolderAsOptionSpy, selectors };
}

describe('ReadonlyFolderPicker', () => {
  describe('when there are no folders', () => {
    it('then the no folder should be selected and Choose should appear', async () => {
      const { selectors } = await getTestContext();

      expect(within(selectors.container.get()).getByText('Choose')).toBeInTheDocument();
    });
  });

  describe('when permissionLevel is set', () => {
    it('then permissionLevel is passed correctly to getFoldersAsOptions', async () => {
      const { getFoldersAsOptionsSpy } = await getTestContext({ permissionLevel: PermissionLevelString.Edit });

      expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
        query: '',
        permissionLevel: 'Edit',
        extraFolders: [],
      });
    });
  });

  describe('when extraFolders is set', () => {
    it('then extraFolders is passed correctly to getFoldersAsOptions', async () => {
      const { getFoldersAsOptionsSpy } = await getTestContext({ extraFolders: [ALL_FOLDER] });

      expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
        query: '',
        permissionLevel: 'View',
        extraFolders: [{ id: undefined, title: 'All' }],
      });
    });
  });

  describe('when entering a query in the input', () => {
    it('then query is passed correctly to getFoldersAsOptions', async () => {
      const { getFoldersAsOptionsSpy, selectors } = await getTestContext();

      expect(within(selectors.container.get()).getByRole('combobox')).toBeInTheDocument();
      getFoldersAsOptionsSpy.mockClear();
      await userEvent.type(within(selectors.container.get()).getByRole('combobox'), 'A');
      await waitFor(() => expect(getFoldersAsOptionsSpy).toHaveBeenCalledTimes(1));

      expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
        query: 'A',
        permissionLevel: 'View',
        extraFolders: [],
      });
    });
  });

  describe('when there are folders', () => {
    it('then the first folder in all folders should be selected', async () => {
      const { selectors } = await getTestContext({}, FOLDERS);

      expect(await within(selectors.container.get()).findByText('General')).toBeInTheDocument();
    });

    describe('and initialFolderId is passed in props and it matches an existing folder', () => {
      it('then the folder with an id equal to initialFolderId should be selected', async () => {
        const { selectors } = await getTestContext({ initialFolderId: 1 }, FOLDERS);

        expect(await within(selectors.container.get()).findByText('Test')).toBeInTheDocument();
      });
    });

    describe('and initialFolderId is passed in props and it does not match an existing folder from search api', () => {
      it('then getFolderAsOption should be called and correct folder should be selected', async () => {
        const folderById = {
          value: { id: 50000, title: 'Outside api search' },
          label: 'Outside api search',
        };
        const { selectors, getFolderAsOptionSpy } = await getTestContext(
          { initialFolderId: 50000 },
          FOLDERS,
          folderById
        );

        expect(await within(selectors.container.get()).findByText('Outside api search')).toBeInTheDocument();
        expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
        expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
      });
    });

    describe('and initialFolderId is passed in props and folder does not exist', () => {
      it('then getFolderAsOption should be called and the first folder should be selected instead', async () => {
        const { selectors, getFolderAsOptionSpy } = await getTestContext(
          { initialFolderId: 50000 },
          FOLDERS,
          undefined
        );

        expect(await within(selectors.container.get()).findByText('General')).toBeInTheDocument();
        expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
        expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
      });
    });
  });
});
