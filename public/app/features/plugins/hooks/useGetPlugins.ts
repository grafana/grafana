import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { sortPlugins, Sorters } from '../helpers';
import { fetchAll } from '../state/actions';
import { find, selectIsRequestPending, selectRequestError, selectIsRequestNotFetched } from '../state/selectors';

type Filters = {
  query?: string;
  filterBy?: string;
  filterByType?: string;
  sortBy?: Sorters;
};

// Returns the list of plugins.
// (Also fetches the plugins if needed)
export const useGetPlugins = ({
  query = '',
  filterBy = 'installed',
  filterByType = 'all',
  sortBy = Sorters.nameAsc,
}: Filters = {}) => {
  const dispatch = useDispatch();
  const { typePrefix } = fetchAll;
  const plugins = useSelector(find(query, filterBy, filterByType));
  const error = useSelector(selectRequestError(typePrefix));
  const isNotFetched = useSelector(selectIsRequestNotFetched(typePrefix));
  const isPending = useSelector(selectIsRequestPending(typePrefix));

  useEffect(() => {
    isNotFetched && dispatch(fetchAll());
  }, [isNotFetched, dispatch]);

  return { plugins: sortPlugins(plugins, sortBy), error, loading: isPending };
};
