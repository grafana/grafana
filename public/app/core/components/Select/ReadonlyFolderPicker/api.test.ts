import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as api from '../../../../features/manage-dashboards/state/actions';
import { DashboardSearchHit } from '../../../../features/search/types';
import { PermissionLevelString } from '../../../../types';

import { ALL_FOLDER, GENERAL_FOLDER } from './ReadonlyFolderPicker';
import { getFolderAsOption, getFoldersAsOptions } from './api';

function getTestContext(
  searchHits: DashboardSearchHit[] = [],
  folderById: { id: number; title: string } = { id: 1, title: 'Folder 1' }
) {
  jest.clearAllMocks();
  const searchFoldersSpy = jest.spyOn(api, 'searchFolders').mockResolvedValue(searchHits);
  const getFolderByIdSpy = jest.spyOn(api, 'getFolderById').mockResolvedValue(folderById);

  return { searchFoldersSpy, getFolderByIdSpy };
}

describe('getFoldersAsOptions', () => {
  describe('when called without permissionLevel and query', () => {
    it('then the correct defaults are passed to the api', async () => {
      const { searchFoldersSpy } = getTestContext();

      await getFoldersAsOptions({ query: '' });

      expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
      expect(searchFoldersSpy).toHaveBeenCalledWith('', 'View');
    });

    describe('and extra folders are passed', () => {
      it('then extra folders should all appear first in the result', async () => {
        const args = { query: '', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
        const searchHits = [{ id: 1, title: 'Folder 1' }] as DashboardSearchHit[];
        getTestContext(searchHits);

        const result = await getFoldersAsOptions(args);
        expect(result).toEqual([
          { value: { id: undefined, title: 'All' }, label: 'All' },
          { value: { id: 0, title: 'General' }, label: 'General' },
          { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
        ]);
      });
    });
  });

  describe('when called with permissionLevel and query', () => {
    it('then the correct values are passed to the api', async () => {
      const { searchFoldersSpy } = getTestContext();

      await getFoldersAsOptions({ query: 'Folder1', permissionLevel: PermissionLevelString.Edit });

      expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
      expect(searchFoldersSpy).toHaveBeenCalledWith('Folder1', 'Edit');
    });

    describe('and extra folders are passed and extra folders contain query', () => {
      it('then correct extra folders should all appear first in the result', async () => {
        const args = { query: 'er', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
        const searchHits = [{ id: 1, title: 'Folder 1' }] as DashboardSearchHit[];
        getTestContext(searchHits);

        const result = await getFoldersAsOptions(args);
        expect(result).toEqual([
          { value: { id: 0, title: 'General' }, label: 'General' },
          { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
        ]);
      });
    });

    describe('and extra folders are passed and extra folders do not contain query', () => {
      it('then no extra folders should appear first in the result', async () => {
        const args = { query: '1', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
        const searchHits = [{ id: 1, title: 'Folder 1' }] as DashboardSearchHit[];
        getTestContext(searchHits);

        const result = await getFoldersAsOptions(args);
        expect(result).toEqual([{ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' }]);
      });
    });
  });
});

describe('getFolderAsOption', () => {
  describe('when called with undefined', () => {
    it('then it should return undefined', async () => {
      const { getFolderByIdSpy } = getTestContext();

      const result = await getFolderAsOption(undefined);
      expect(result).toBeUndefined();
      expect(getFolderByIdSpy).not.toHaveBeenCalled();
    });
  });

  describe('when called with a folder id that does not exist', () => {
    silenceConsoleOutput();
    it('then it should return undefined', async () => {
      const { getFolderByIdSpy } = getTestContext();
      getFolderByIdSpy.mockRejectedValue('Not found');

      const result = await getFolderAsOption(-1);
      expect(result).toBeUndefined();
      expect(getFolderByIdSpy).toHaveBeenCalled();
    });
  });

  describe('when called with a folder id that exist', () => {
    it('then it should return a SelectableValue of FolderInfo', async () => {
      const { getFolderByIdSpy } = getTestContext();

      const result = await getFolderAsOption(1);
      expect(result).toEqual({ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' });
      expect(getFolderByIdSpy).toHaveBeenCalled();
    });
  });
});
