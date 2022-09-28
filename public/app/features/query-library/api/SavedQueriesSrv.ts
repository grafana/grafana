import { getBackendSrv } from '../../../core/services/backend_srv';
import { SavedQueryUpdateOpts } from '../components/QueryEditorDrawer';

import { SavedQuery, SavedQueryRef } from './SavedQueriesApi';

export class SavedQuerySrv {
  getSavedQueries = async (refs: SavedQueryRef[]): Promise<SavedQuery[]> => {
    if (!refs.length) {
      return [];
    }
    const uidParams = refs.map((r) => `uid=${r.uid}`).join('&');
    return getBackendSrv().get<SavedQuery[]>(`/api/query-library/get?${uidParams}`);
  };

  deleteSavedQuery = async (ref: SavedQueryRef): Promise<void> => {
    return getBackendSrv().delete(`/api/query-library/delete?uid=${ref.uid}`);
  };

  updateSavedQuery = async (query: SavedQuery, options: SavedQueryUpdateOpts): Promise<void> => {
    return getBackendSrv().post(`/api/query-library/update`, query);
  };
}

const savedQuerySrv = new SavedQuerySrv();

export const getSavedQuerySrv = () => savedQuerySrv;
