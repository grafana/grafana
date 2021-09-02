import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAll, fetchDetails, install, uninstall } from './actions';
import { CatalogPlugin } from '../types';
import {
  selectAll,
  selectById,
  selectIsRequestPending,
  selectRequestError,
  selectIsRequestNotFetched,
} from './selectors';

export const useGetAll = (): CatalogPlugin[] => {
  useFetchAll();

  return useSelector(selectAll);
};

export const useGetSingle = (id: string): CatalogPlugin | undefined => {
  useFetchAll();
  useFetchDetails(id);

  return useSelector((state) => selectById(state, id));
};

export const useInstall = () => {
  const dispatch = useDispatch();

  return (id: string) => dispatch(install(id));
};

export const useUninstall = () => {
  const dispatch = useDispatch();

  return (id: string) => dispatch(uninstall(id));
};

export const useFetchStatus = () => {
  const isLoading = useSelector(selectIsRequestPending(fetchAll.typePrefix));
  const error = useSelector(selectRequestError(fetchAll.typePrefix));

  return { isLoading, error };
};

// Only fetches in case they were not fetched yet
export const useFetchAll = () => {
  const dispatch = useDispatch();
  const isNotFetched = useSelector(selectIsRequestNotFetched(fetchAll.typePrefix));

  useEffect(() => {
    isNotFetched && dispatch(fetchAll());
  }, []); // eslint-disable-line
};

export const useFetchDetails = (id: string) => {
  const dispatch = useDispatch();
  const plugin = useSelector((state) => selectById(state, id));
  const isPending = useSelector(selectIsRequestPending(fetchDetails.typePrefix));
  const shouldFetch = !isPending && !plugin?.details;

  useEffect(() => {
    shouldFetch && dispatch(fetchDetails(id));
  }, []); // eslint-disable-line
};
