import { useAsync } from 'react-use';

import { QueryWithDefaults } from '../defaults';
import { DB } from '../types';

type Options = {
  db: DB;
  query: QueryWithDefaults;
  isOrderable?: boolean;
};

export function useColumns({ db, query, isOrderable = false }: Options) {
  const datasourceId = db.dsID();
  const { value: init } = useAsync(async () => await db.init(datasourceId), []);

  const state = useAsync(async () => {
    return await db.fields(query, isOrderable);
  }, [query.dataset, query.table, init]);

  return state;
}
