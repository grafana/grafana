import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAll, install, uninstall } from './actions';
import { selectAll, selectById } from './selectors';
import { CatalogPlugin } from '../types';

export const useGetAll = (): CatalogPlugin[] => {
  useFetchAll();

  return useSelector(selectAll);
};

export const useGetSingle = (id: string): CatalogPlugin | undefined => {
  useFetchAll();

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

export const useFetchAll = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchAll());
  }, []); // eslint-disable-line
};
