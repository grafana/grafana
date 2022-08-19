import { getGrafanaStorage } from '../../storage/storage';
import { WorkflowID } from '../../storage/types';

import { SavedQuery, SavedQueryRef } from './SavedQueriesApi';

export class SavedQuerySrv {
  getSavedQueryByUids = async (refs: SavedQueryRef[]): Promise<SavedQuery[]> => {
    const storage = getGrafanaStorage();
    return Promise.all(
      refs.map(async (ref) => {
        const [savedQuery, options] = await Promise.all([
          storage.get<SavedQuery>(ref.uid),
          storage.getOptions(ref.uid),
        ]);

        return {
          ...savedQuery,
          uid: ref.uid,
          storageOptions: options,
        };
      })
    );
  };

  deleteSavedQuery = async (ref: SavedQueryRef): Promise<void> => {
    await getGrafanaStorage().delete({ isFolder: false, path: ref.uid });
  };

  updateSavedQuery = async (
    query: SavedQuery,
    options?: { message?: string; workflow?: WorkflowID }
  ): Promise<void> => {
    const path = query.uid?.length ? query.uid : `system/queries/${query.title}.json`;
    await getGrafanaStorage().write(path, {
      kind: 'query',
      body: query,
      title: query.title,
      message: options?.message,
      workflow: options?.workflow ?? WorkflowID.Save,
    });
  };
}

const savedQuerySrv = new SavedQuerySrv();

export const getSavedQuerySrv = () => savedQuerySrv;
