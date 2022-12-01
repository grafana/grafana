import { getBackendSrv } from 'app/core/services/backend_srv';
import { SavedQueryUpdateOpts } from 'app/features/query-library/components/QueryEditorDrawer';

import { SavedQuery, SavedQueryRef } from './SavedQueriesApi';

export class SavedQuerySrv {
  getSavedQueries = async (refs: SavedQueryRef[]): Promise<SavedQuery[]> => {
    if (!refs.length) {
      return [];
    }
    const uidParams = refs.map((r) => `uid=${r.uid}`).join('&');
    return getBackendSrv().get<SavedQuery[]>(`/api/query-library?${uidParams}`);
  };

  deleteSavedQuery = async (ref: SavedQueryRef): Promise<void> => {
    return getBackendSrv().delete(`/api/query-library?uid=${ref.uid}`);
  };

  updateSavedQuery = async (query: SavedQuery, options: SavedQueryUpdateOpts): Promise<void> => {
    return getBackendSrv().post(`/api/query-library`, query);
  };
}

const savedQuerySrv = new SavedQuerySrv();

export const getSavedQuerySrv = () => savedQuerySrv;
