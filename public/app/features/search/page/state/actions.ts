import { ThunkResult } from 'app/types';
import { fetchResults } from './reducers';

export const loadResults = (query: string): ThunkResult<void> => {
  return async (dispatch) => {
    return dispatch(
      fetchResults({
        data: {
          results: {} as any,
        },
      })
    );
  };
};
