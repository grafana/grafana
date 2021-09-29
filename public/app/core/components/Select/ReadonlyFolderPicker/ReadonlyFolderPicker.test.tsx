import React from 'react';
import { SelectableValue } from '@grafana/data';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { byTestId } from 'testing-library-selector';

import * as api from './api';
import { FolderInfo, PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker, ReadonlyFolderPickerProps } from './ReadonlyFolderPicker';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

async function getTestContext(
  propOverrides: Partial<ReadonlyFolderPickerProps> = {},
  folders: Array<SelectableValue<FolderInfo>> = []
) {
  jest.clearAllMocks();
  const selectors = {
    container: byTestId(e2eSelectors.components.ReadonlyFolderPicker.container),
  };
  const getFoldersAsOptionsSpy = jest.spyOn(api, 'getFoldersAsOptions').mockResolvedValue(folders);
  const props: ReadonlyFolderPickerProps = {
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<ReadonlyFolderPicker {...props} />);
  await waitFor(() => expect(getFoldersAsOptionsSpy).toHaveBeenCalledTimes(1));

  return { getFoldersAsOptionsSpy, selectors };
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

      expect(within(selectors.container.get()).getByRole('textbox')).toBeInTheDocument();
      getFoldersAsOptionsSpy.mockClear();
      await userEvent.type(within(selectors.container.get()).getByRole('textbox'), 'A');
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
      const { selectors } = await getTestContext({}, [
        { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
        { value: { id: 1, title: 'Test' }, label: 'Test' },
      ]);

      expect(within(selectors.container.get()).getByText(GENERAL_FOLDER.title!)).toBeInTheDocument();
    });

    describe('and initialFolderId is passed in props and it matches an existing folder', () => {
      it('then the folder with an id equal to initialFolderId should be selected', async () => {
        const { selectors } = await getTestContext({ initialFolderId: 1 }, [
          { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
          { value: { id: 1, title: 'Test' }, label: 'Test' },
        ]);

        expect(within(selectors.container.get()).getByText('Test')).toBeInTheDocument();
      });
    });

    describe('and initialFolderId is passed in props and it does not match an existing folder', () => {
      it('then the first folder in all folders should be selected', async () => {
        const { selectors } = await getTestContext({ initialFolderId: 2 }, [
          { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
          { value: { id: 1, title: 'Test' }, label: 'Test' },
        ]);

        expect(within(selectors.container.get()).getByText(GENERAL_FOLDER.title!)).toBeInTheDocument();
      });
    });
  });
});
