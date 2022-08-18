import { useSelector } from 'react-redux';

import { selectPluginErrors } from '../state/selectors';

import { useGetPlugins } from './useGetPlugins';

// Returns all plugin related errors
export const useGetErrorsPluginErrors = () => {
  const { loading } = useGetPlugins();
  const errors = useSelector(selectPluginErrors);

  return { errors, loading };
};
