import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchSingle } from '../state/actions';
import { selectById, selectIsRequestPending, selectRequestError, selectIsRequestNotFetched } from '../state/selectors';
import { PluginCatalogStoreState } from '../types';

// Returns a single plugin by id.
// (Also fetches the plugin if needed)
export const useGetPlugin = (id: string) => {
  const dispatch = useDispatch();
  const { typePrefix } = fetchSingle;
  const plugin = useSelector((state: PluginCatalogStoreState) => selectById(state, id));
  const error = useSelector(selectRequestError(typePrefix));
  const isPending = useSelector(selectIsRequestPending(typePrefix));
  const isNotFetched = useSelector(selectIsRequestNotFetched(typePrefix));
  const isDetailsMissing = !plugin?.settings.module || !plugin.settings.baseUrl || !plugin.readme;
  const shouldFetch = isNotFetched || isDetailsMissing;

  useEffect(() => {
    shouldFetch && dispatch(fetchSingle(id));
  }, [shouldFetch, dispatch, id]);

  return { plugin, error, loading: isPending || shouldFetch };
};
