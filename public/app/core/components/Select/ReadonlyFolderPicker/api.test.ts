import * as api from '../../../../features/manage-dashboards/state/actions';
import { getFoldersAsOptions } from './api';
import { DashboardSearchHit } from '../../../../features/search/types';
import { PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER } from './ReadonlyFolderPicker';

function getTestContext(searchHits: DashboardSearchHit[] = []) {
  jest.clearAllMocks();
  const searchFoldersSpy = jest.spyOn(api, 'searchFolders').mockResolvedValue(searchHits);

  return { searchFoldersSpy };
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
        const searchHits: any[] = [{ id: 1, title: 'Folder 1' }];
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
        const searchHits: any[] = [{ id: 1, title: 'Folder 1' }];
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
        const searchHits: any[] = [{ id: 1, title: 'Folder 1' }];
        getTestContext(searchHits);

        const result = await getFoldersAsOptions(args);
        expect(result).toEqual([{ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' }]);
      });
    });
  });
});
