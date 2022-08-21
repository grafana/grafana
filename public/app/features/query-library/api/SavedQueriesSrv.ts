import { getGrafanaStorage } from '../../storage/storage';
import { WorkflowID } from '../../storage/types';
import { SavedQueryUpdateOpts } from '../components/QueryEditorDrawer';

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
    await getGrafanaStorage().delete({ isFolder: false, path: ref.uid ?? null });
  };

  updateSavedQuery = async (query: SavedQuery, options: SavedQueryUpdateOpts): Promise<void> => {
    if (!query?.queries?.length) {
      throw new Error('Invalid query!');
    }
    const path = this.getPath(query, options);
    await getGrafanaStorage().write(path, {
      kind: 'query',
      body: {
        ...query,
        uid: undefined,
        storageOptions: undefined,
      },
      title: query.title,
      message: options?.message,
      workflow: options?.workflowId ?? WorkflowID.Save,
    });
  };

  getPath = (query: SavedQuery, options: SavedQueryUpdateOpts) => {
    if (!options || options?.type === 'edit') {
      return query.uid?.length ? query.uid : `system/queries/${query.title}.json`;
    }

    if (options.storage === 'sql') {
      return `system/queries/${query.title}.json`;
    }

    return `it/${query.title}.json`;
  };
}

const savedQuerySrv = new SavedQuerySrv();

export const getSavedQuerySrv = () => savedQuerySrv;
