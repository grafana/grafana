import { useDispatch, useSelector } from 'react-redux';

import { uninstall } from '../state/actions';
import { selectIsRequestPending, selectRequestError } from '../state/selectors';

export const useUninstallPlugin = () => {
  const dispatch = useDispatch();
  const { typePrefix } = uninstall;
  const loading = useSelector(selectIsRequestPending(typePrefix));
  const error = useSelector(selectRequestError(typePrefix));
  const callback = (id: string) => dispatch(uninstall(id));

  return {
    uninstall: callback,
    loading,
    error,
  };
};
