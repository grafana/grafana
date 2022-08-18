import { useDispatch, useSelector } from 'react-redux';

import { install } from '../state/actions';
import { selectIsRequestPending, selectRequestError } from '../state/selectors';

export const useInstallPlugin = () => {
  const dispatch = useDispatch();
  const { typePrefix } = install;
  const loading = useSelector(selectIsRequestPending(typePrefix));
  const error = useSelector(selectRequestError(typePrefix));
  const callback = (id: string, version?: string, isUpdating?: boolean) =>
    dispatch(install({ id, version, isUpdating }));

  return {
    install: callback,
    loading,
    error,
  };
};
