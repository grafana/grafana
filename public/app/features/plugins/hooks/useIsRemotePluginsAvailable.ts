import { useSelector } from 'react-redux';

import { fetchRemotePlugins } from '../state/actions';
import { selectRequestError } from '../state/selectors';

// TODO: remove this from the store
export const useIsRemotePluginsAvailable = () => {
  const error = useSelector(selectRequestError(fetchRemotePlugins.typePrefix));
  return error === null;
};
