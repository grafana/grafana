import { getGrafanaStorage } from '../../storage/storage';
import { WorkflowID } from '../../storage/types';

import { SavedQuery, SavedQueryRef } from './SavedQueriesApi';

export class SavedQuerySrv {
  getSavedQueryByUids = async (refs: SavedQueryRef[]): Promise<SavedQuery[]> => {
    const storage = getGrafanaStorage();
    return Promise.all(refs.map((ref) => storage.get<SavedQuery>(ref.uid)));
  };

  deleteSavedQuery = async (ref: SavedQueryRef): Promise<void> => {
    await getGrafanaStorage().delete({ isFolder: false, path: ref.uid });
  };

  updateSavedQuery = async (query: SavedQuery): Promise<void> => {
    const path = `system/queries/${query.title}.json`;
    await getGrafanaStorage().write(path, {
      kind: 'query',
      body: query,
      title: query.title,
      workflow: WorkflowID.Save,
    });
  };
}

const savedQuerySrv = new SavedQuerySrv();

export const getSavedQuerySrv = () => savedQuerySrv;
