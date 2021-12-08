import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types';
import { libraryCredentialsLoaded } from './reducers';

export function loadLibraryCredentials(): ThunkResult<void> {
  return async (dispatch) => {
    const response = await getBackendSrv().get('/api/library-credentials');
    dispatch(libraryCredentialsLoaded(response));
  };
}

export function deleteLibraryCredentials(id: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/library-credentials/${id}`);
    dispatch(loadLibraryCredentials());
  };
}
